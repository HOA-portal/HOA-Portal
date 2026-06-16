// Direct document processing route — bypasses the Edge Function / pgmq / pg_cron chain.
// Called fire-and-forget from the upload route, and can be called manually from the
// admin panel to unblock stuck documents.
//
// Processes ONE pending document per call (oldest first, claimed atomically).
// Returns immediately if no pending documents exist.

import { createClient, createServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { extractText, getDocumentProxy } from 'unpdf'
import type { Profile } from '@/types/database'

export const maxDuration = 120

// ── Constants (mirror the Edge Function) ──────────────────────────────────

const SCANNED_PAGE_THRESHOLD = 50
const TARGET_TOKENS = 500
const MAX_TOKENS = 650
const CHARS_PER_TOKEN = 4
const OVERLAP_CHARS = 400
const INSERT_BATCH = 50
const ARTICLE_RE = /^ARTICLE\s+([IVXLCDM]+|\d+)[.:\s]\s*(.*)/i
const SECTION_RE = /^(?:SECTION|SEC\.?)\s+(\d+(?:\.\d+)*)[.:)]\s*(.*)/i
const SUBSECTION_RE = /^\s*\(([a-zA-Z])\)\s+/i

// ── Types ─────────────────────────────────────────────────────────────────

interface PageContent { pageNumber: number; text: string; isImageOnly: boolean }

interface HierarchicalSection {
  type: 'article_header' | 'section' | 'subsection' | 'body'
  title: string | null
  article: string | null
  section: string | null
  subsection: string | null
  content: string
  pageNumbers: number[]
  hierarchyPath: string
}

interface DocumentChunk {
  content: string
  embed_content: string
  section_title: string | null
  chunk_index: number
  metadata: {
    article: string | null
    section: string | null
    subsection: string | null
    page_numbers: number[]
    section_type: string
    hierarchy_path: string
    is_ocr: boolean
  }
}

// ── Route Handler ──────────────────────────────────────────────────────────

export async function POST(): Promise<Response> {
  const supabase = await createClient()
  const serviceClient = await createServiceClient()

  // Auth: admin only
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null; error: unknown }

  if (!profile || profile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const hoaId = profile.hoa_id

  // Claim the oldest pending document atomically: only succeeds if status is still 'pending'.
  const { data: pending } = await serviceClient
    .from('ccr_documents')
    .select('id, storage_path, filename')
    .eq('hoa_id', hoaId)
    .eq('status', 'pending')
    .order('last_queued_at', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle()

  if (!pending) {
    return Response.json({ processed: 0, message: 'No pending documents' })
  }

  // Optimistic claim: set status → processing. If another worker beat us, data will be null.
  const { data: claimed } = await serviceClient
    .from('ccr_documents')
    .update({ status: 'processing' })
    .eq('id', pending.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (!claimed) {
    return Response.json({ processed: 0, message: 'Document already claimed by another worker' })
  }

  const docId = claimed.id
  const errors: string[] = []

  try {
    const result = await processDocument(serviceClient, docId, hoaId, pending.storage_path)
    return Response.json({ processed: 1, docId, ...result })
  } catch (err) {
    const message = String(err).slice(0, 500)
    errors.push(message)
    await serviceClient
      .from('ccr_documents')
      .update({ status: 'failed', error_message: message })
      .eq('id', docId)
    return Response.json({ processed: 0, errors }, { status: 500 })
  }
}

// ── Core Processing ────────────────────────────────────────────────────────

async function processDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: any,
  docId: string,
  hoaId: string,
  storagePath: string
): Promise<{ chunks: number; pages: number; isOcr: boolean }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  // Download from storage
  const { data: fileBlob, error: dlError } = await serviceClient
    .storage
    .from('ccr-documents')
    .download(storagePath)

  if (dlError || !fileBlob) {
    throw new Error(`Storage download failed: ${dlError?.message ?? 'no data'}`)
  }

  const pdfBuffer = await (fileBlob as Blob).arrayBuffer()

  // Extract pages (with OCR fallback)
  const { pages, isOcr } = await extractPages(pdfBuffer)

  // Parse CC&R hierarchy
  const sections = parseHierarchy(pages)
  const allChunks: DocumentChunk[] = []
  for (const section of sections) {
    allChunks.push(...chunkSection(section, isOcr, storagePath))
  }
  allChunks.forEach((c, i) => { c.chunk_index = i })

  // Guard: if OCR was needed but produced no chunks, fail loudly so the user can retry
  if (allChunks.length === 0) {
    await serviceClient
      .from('ccr_documents')
      .update({
        status: 'failed',
        error_message: isOcr
          ? 'OCR ran but no text was extracted. The PDF may be corrupted or in an unsupported format.'
          : 'No text found in PDF. The document may be a scanned image — retry to attempt OCR.',
        page_count: pages.length,
      })
      .eq('id', docId)
    return { chunks: 0, pages: pages.length, isOcr }
  }

  // Inject backward overlap into embed_content
  for (let i = 1; i < allChunks.length; i++) {
    const overlap = allChunks[i - 1].content.slice(-OVERLAP_CHARS)
    if (overlap) allChunks[i].embed_content = overlap + '\n' + allChunks[i].embed_content
  }

  // Embed all chunks in one batched call
  const embeddings = await embedBatch(openai, allChunks.map(c => c.embed_content))

  // Bulk insert in batches of INSERT_BATCH
  for (let i = 0; i < allChunks.length; i += INSERT_BATCH) {
    const batch = allChunks.slice(i, i + INSERT_BATCH)
    const rows = batch.map((chunk, j) => ({
      hoa_id: hoaId,
      document_id: docId,
      content: chunk.content,
      section_title: chunk.section_title,
      embedding: embeddings[i + j],
      chunk_index: chunk.chunk_index,
      metadata: chunk.metadata,
    }))
    const { error: insertErr } = await serviceClient.from('ccr_chunks').insert(rows)
    if (insertErr) throw new Error(`Chunk insert failed: ${insertErr.message}`)
  }

  await serviceClient
    .from('ccr_documents')
    .update({
      status: 'completed',
      page_count: pages.length,
      chunk_count: allChunks.length,
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', docId)

  return { chunks: allChunks.length, pages: pages.length, isOcr }
}

// ── PDF Extraction + OCR ───────────────────────────────────────────────────

const OCR_BLOCK_SIZE = 40  // pages per Claude OCR call (Haiku max output ~8192 tokens)

async function extractPages(
  pdfBuffer: ArrayBuffer
): Promise<{ pages: PageContent[]; isOcr: boolean }> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer))
  const { text: pageTexts } = await extractText(pdf, { mergePages: false })

  let pages: PageContent[] = (pageTexts as string[]).map((text, idx) => ({
    pageNumber: idx + 1,
    text,
    isImageOnly: text.trim().length < SCANNED_PAGE_THRESHOLD,
  }))

  const imageOnlyCount = pages.filter(p => p.isImageOnly).length
  const isOcr = imageOnlyCount / Math.max(pages.length, 1) > 0.3

  if (isOcr && process.env.ANTHROPIC_API_KEY) {
    const base64 = bufferToBase64(pdfBuffer)
    let allLines: string[] = []

    for (let start = 1; start <= pages.length; start += OCR_BLOCK_SIZE) {
      const end = Math.min(start + OCR_BLOCK_SIZE - 1, pages.length)
      const text = await ocrPageRange(base64, start, end)
      allLines.push(...text.split('\n'))
    }

    const linesPerPage = Math.max(1, Math.ceil(allLines.length / pages.length))
    pages = pages.map((page, idx) => ({
      ...page,
      text: allLines.slice(idx * linesPerPage, (idx + 1) * linesPerPage).join('\n'),
      isImageOnly: false,
    }))
  }

  return { pages, isOcr }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 32768
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)))
  }
  return btoa(binary)
}

async function ocrPageRange(base64Pdf: string, startPage: number, endPage: number): Promise<string> {
  const rangeNote = startPage === endPage ? `page ${startPage}` : `pages ${startPage} through ${endPage}`
  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    maxTokens: 8192,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'file',
          data: base64Pdf,
          mimeType: 'application/pdf',
        },
        {
          type: 'text',
          text: `Extract the text from ${rangeNote} of this document verbatim. Preserve article and section headings exactly as written. Output only the extracted text.`,
        },
      ],
    }],
  })
  return text
}

// ── Hierarchy Parsing ──────────────────────────────────────────────────────

function parseHierarchy(pages: PageContent[]): HierarchicalSection[] {
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
    sections.push({ type: curType, title: curTitle, article: curArticle, section: curSection, subsection: curSubsection, content, pageNumbers: [], hierarchyPath: buildPath() })
    curContent = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue

    const articleMatch = t.match(ARTICLE_RE)
    if (articleMatch) {
      flush()
      curArticle = articleMatch[1].toUpperCase()
      curSection = null; curSubsection = null
      curTitle = `Article ${curArticle}${articleMatch[2] ? ': ' + articleMatch[2].trim() : ''}`
      curType = 'article_header'; curContent.push(t); continue
    }

    const sectionMatch = t.match(SECTION_RE)
    if (sectionMatch) {
      flush()
      curSection = sectionMatch[1]; curSubsection = null
      curTitle = `Section ${curSection}${sectionMatch[2] ? ': ' + sectionMatch[2].trim() : ''}`
      curType = 'section'; curContent.push(t); continue
    }

    const subsectionMatch = t.match(SUBSECTION_RE)
    if (subsectionMatch && curSection) {
      flush()
      curSubsection = subsectionMatch[1]
      curType = 'subsection'; curContent.push(t); continue
    }

    curContent.push(t)
  }

  flush()

  if (sections.length === 0) {
    const content = lines.join('\n').trim()
    if (content) sections.push({ type: 'body', title: 'General Rules', article: null, section: null, subsection: null, content, pageNumbers: [], hierarchyPath: '' })
  }

  return sections
}

// ── Chunking ───────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function splitIntoPropositions(text: string): string[] {
  const paragraphs = text.replace(/\n{3,}/g, '\n\n').split(/\n\n+/)
  const propositions: string[] = []
  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue
    if (estimateTokens(trimmed) <= MAX_TOKENS) { propositions.push(trimmed); continue }
    const sentences = trimmed.replace(/([.?!;])\s+(?=[A-Z(])/g, '$1\n').split('\n').map(s => s.trim()).filter(Boolean)
    propositions.push(...sentences)
  }
  return propositions
}

function chunkSection(section: HierarchicalSection, isOcr: boolean, storagePath: string): DocumentChunk[] {
  const filename = storagePath.split('/').pop() ?? storagePath
  const pathCtx = section.hierarchyPath ? `${filename} > ${section.hierarchyPath}` : filename
  const prefix = `[${pathCtx}] `
  const propositions = splitIntoPropositions(section.content)
  const chunks: DocumentChunk[] = []
  let pending: string[] = []
  let pendingTokens = 0

  const makeMetadata = () => ({ article: section.article, section: section.section, subsection: section.subsection, page_numbers: section.pageNumbers, section_type: section.type, hierarchy_path: section.hierarchyPath, is_ocr: isOcr })

  function flush() {
    if (!pending.length) return
    const content = pending.join('\n\n').trim()
    if (!content) return
    chunks.push({ content, embed_content: prefix + content, section_title: section.title, chunk_index: 0, metadata: makeMetadata() })
    pending = []; pendingTokens = 0
  }

  for (const prop of propositions) {
    const propTokens = estimateTokens(prop)
    if (propTokens > MAX_TOKENS) { flush(); chunks.push({ content: prop, embed_content: prefix + prop, section_title: section.title, chunk_index: 0, metadata: makeMetadata() }); continue }
    if (pendingTokens + propTokens > MAX_TOKENS && pending.length > 0) flush()
    pending.push(prop)
    pendingTokens += propTokens
    if (pendingTokens >= TARGET_TOKENS) flush()
  }

  flush()
  return chunks
}

// ── Embedding ──────────────────────────────────────────────────────────────

async function embedBatch(openai: OpenAI, texts: string[]): Promise<number[][]> {
  const MAX_BATCH = 2048
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH)
    const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: batch, dimensions: 1536 })
    results.push(...res.data.map(d => d.embedding))
  }
  return results
}
