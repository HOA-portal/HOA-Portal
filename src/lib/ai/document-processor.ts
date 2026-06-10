import pLimit from 'p-limit'
import { extractText, getDocumentProxy } from 'unpdf'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

// ============================================================
// Types
// ============================================================

export interface ChunkMetadata {
  article: string | null
  section: string | null
  subsection: string | null
  page_numbers: number[]
  section_type: 'article_header' | 'section' | 'subsection' | 'body'
  hierarchy_path: string
  is_ocr: boolean
}

export interface DocumentChunk {
  content: string       // raw text stored in DB and shown to user
  embed_content: string // hierarchy-prefixed text used for embedding
  section_title: string | null
  chunk_index: number
  metadata: ChunkMetadata
}

export interface ProcessingResult {
  chunks: DocumentChunk[]
  page_count: number
  ocr_page_count: number
}

interface PageContent {
  pageNumber: number
  text: string
  isImageOnly: boolean
}

interface HierarchicalSection {
  type: ChunkMetadata['section_type']
  title: string | null
  article: string | null
  section: string | null
  subsection: string | null
  content: string
  pageNumbers: number[]
  hierarchyPath: string
}

// ============================================================
// Constants
// ============================================================

const SCANNED_PAGE_THRESHOLD = 50 // chars/page below this → image-only
const TARGET_TOKENS = 500         // aim for this chunk size
const MAX_TOKENS = 650            // hard cap before forced split
const CHARS_PER_TOKEN = 4         // approximation to avoid tokenizer dep

// Article header: ARTICLE IV. or ARTICLE 4 — Governance
const ARTICLE_RE = /^ARTICLE\s+([IVXLCDM]+|\d+)[.:\s]\s*(.*)/i
// Section header: Section 3.2. or SECTION 3 — Pets
const SECTION_RE = /^(?:SECTION|Section|SEC\.?)\s+(\d+(?:\.\d+)*)[.:)]\s*(.*)/
// Lettered subsection: (a) or (b)
const SUBSECTION_RE = /^\s*\(([a-zA-Z])\)\s+/

// ============================================================
// Step 1 — PDF Text Extraction
// ============================================================

export async function extractTextFromPdf(pdfBuffer: ArrayBuffer): Promise<PageContent[]> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer))
  const { text: pageTexts } = await extractText(pdf, { mergePages: false })

  return pageTexts.map((text, idx) => ({
    pageNumber: idx + 1,
    text,
    isImageOnly: text.trim().length < SCANNED_PAGE_THRESHOLD,
  }))
}

// ============================================================
// Step 2 — OCR via Claude (scanned / image-only PDFs)
// Sends the full PDF as a document to claude-haiku for text extraction.
// For PDFs > ~80 pages of dense scan this may hit context limits —
// callers should split large scanned docs into batches before calling.
// ============================================================

export async function ocrDocument(pdfBuffer: ArrayBuffer): Promise<string> {
  const base64 = Buffer.from(pdfBuffer).toString('base64')

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file' as const,
            data: base64,
            mimeType: 'application/pdf' as const,
          },
          {
            type: 'text' as const,
            text: 'Extract all text from this document verbatim. Preserve article and section headings exactly as written, including their labels (e.g. ARTICLE IV, Section 3.2). Output only the extracted text with no commentary.',
          },
        ],
      },
    ],
    maxTokens: 8192,
  })

  return text
}

// ============================================================
// Step 3 — Hierarchy Parsing
// Splits flat text into Article → Section → Subsection segments.
// Falls back to a single "General" body section if no headers found.
// ============================================================

export function parseHierarchy(pages: PageContent[]): HierarchicalSection[] {
  const lines = pages.flatMap(p => p.text.split('\n'))

  const sections: HierarchicalSection[] = []
  let curArticle: string | null = null
  let curSection: string | null = null
  let curSubsection: string | null = null
  let curTitle: string | null = null
  let curType: HierarchicalSection['type'] = 'body'
  let curContent: string[] = []

  function buildPath(): string {
    const parts: string[] = []
    if (curArticle) parts.push(`Article ${curArticle}`)
    if (curSection) parts.push(`Section ${curSection}`)
    if (curSubsection) parts.push(`(${curSubsection})`)
    return parts.join(' > ')
  }

  function flush() {
    const content = curContent.join('\n').trim()
    if (!content) return
    sections.push({
      type: curType,
      title: curTitle,
      article: curArticle,
      section: curSection,
      subsection: curSubsection,
      content,
      pageNumbers: [],
      hierarchyPath: buildPath(),
    })
    curContent = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue

    const articleMatch = t.match(ARTICLE_RE)
    if (articleMatch) {
      flush()
      curArticle = articleMatch[1].toUpperCase()
      curSection = null
      curSubsection = null
      curTitle = `Article ${curArticle}${articleMatch[2] ? ': ' + articleMatch[2].trim() : ''}`
      curType = 'article_header'
      curContent.push(t)
      continue
    }

    const sectionMatch = t.match(SECTION_RE)
    if (sectionMatch) {
      flush()
      curSection = sectionMatch[1]
      curSubsection = null
      curTitle = `Section ${curSection}${sectionMatch[2] ? ': ' + sectionMatch[2].trim() : ''}`
      curType = 'section'
      curContent.push(t)
      continue
    }

    const subsectionMatch = t.match(SUBSECTION_RE)
    if (subsectionMatch && curSection) {
      flush()
      curSubsection = subsectionMatch[1]
      curType = 'subsection'
      curContent.push(t)
      continue
    }

    curContent.push(t)
  }

  flush()

  // If no structural headers were found treat whole document as body
  if (sections.length === 0) {
    const content = lines.join('\n').trim()
    if (content) {
      sections.push({
        type: 'body',
        title: 'General Rules',
        article: null,
        section: null,
        subsection: null,
        content,
        pageNumbers: [],
        hierarchyPath: '',
      })
    }
  }

  return sections
}

// ============================================================
// Step 4 — Semantic Chunking
// Keeps sentences together, respects TARGET_TOKENS target and
// MAX_TOKENS hard cap, prefixes embed_content with hierarchy path.
// ============================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by a capital letter.
  // Avoids splitting on abbreviations like "Sec.", "i.e.", "e.g."
  return text
    .replace(/([.?!])\s+(?=[A-Z])/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}

export function chunkSection(
  section: HierarchicalSection,
  targetTokens = TARGET_TOKENS,
  maxTokens = MAX_TOKENS,
  isOcr = false
): DocumentChunk[] {
  const prefix = section.hierarchyPath ? `[${section.hierarchyPath}] ` : ''
  const sentences = splitIntoSentences(section.content)
  const chunks: DocumentChunk[] = []
  let pending: string[] = []
  let pendingTokens = 0

  function flush() {
    if (!pending.length) return
    const content = pending.join(' ').trim()
    if (!content) return
    chunks.push({
      content,
      embed_content: prefix + content,
      section_title: section.title,
      chunk_index: 0, // re-indexed globally in processDocument
      metadata: {
        article: section.article,
        section: section.section,
        subsection: section.subsection,
        page_numbers: section.pageNumbers,
        section_type: section.type,
        hierarchy_path: section.hierarchyPath,
        is_ocr: isOcr,
      },
    })
    pending = []
    pendingTokens = 0
  }

  for (const sentence of sentences) {
    const sentTokens = estimateTokens(sentence)

    // If a single sentence exceeds max, emit it alone
    if (sentTokens > maxTokens) {
      flush()
      chunks.push({
        content: sentence,
        embed_content: prefix + sentence,
        section_title: section.title,
        chunk_index: 0,
        metadata: {
          article: section.article,
          section: section.section,
          subsection: section.subsection,
          page_numbers: section.pageNumbers,
          section_type: section.type,
          hierarchy_path: section.hierarchyPath,
          is_ocr: isOcr,
        },
      })
      continue
    }

    if (pendingTokens + sentTokens > maxTokens && pending.length > 0) {
      flush()
    }

    pending.push(sentence)
    pendingTokens += sentTokens

    if (pendingTokens >= targetTokens) {
      flush()
    }
  }

  flush()
  return chunks
}

// ============================================================
// Main Entry Point
// ============================================================

export async function processDocument(pdfBuffer: ArrayBuffer): Promise<ProcessingResult> {
  // 1. Extract text layer (works perfectly for digital PDFs)
  let pages = await extractTextFromPdf(pdfBuffer)
  const imageOnlyCount = pages.filter(p => p.isImageOnly).length
  const scannedRatio = imageOnlyCount / Math.max(pages.length, 1)

  let isOcr = false

  // 2. If > 30% of pages are image-only, OCR the entire document with Claude
  if (scannedRatio > 0.3) {
    isOcr = true
    const ocrText = await ocrDocument(pdfBuffer)

    // Redistribute OCR text back across pages for structure preservation
    const ocrLines = ocrText.split('\n')
    const linesPerPage = Math.max(1, Math.ceil(ocrLines.length / pages.length))
    pages = pages.map((page, idx) => ({
      ...page,
      text: ocrLines.slice(idx * linesPerPage, (idx + 1) * linesPerPage).join('\n'),
      isImageOnly: false,
    }))
  }

  // 3. Parse article / section / subsection hierarchy
  const sections = parseHierarchy(pages)

  // 4. Chunk each section — use concurrency limit for CPU-bound work
  const limit = pLimit(4)
  const chunkArrays = await Promise.all(
    sections.map(section =>
      limit(() => Promise.resolve(chunkSection(section, TARGET_TOKENS, MAX_TOKENS, isOcr)))
    )
  )

  // 5. Flatten and globally re-index
  const chunks = chunkArrays.flat()
  chunks.forEach((chunk, idx) => { chunk.chunk_index = idx })

  return {
    chunks,
    page_count: pages.length,
    ocr_page_count: isOcr ? imageOnlyCount : 0,
  }
}
