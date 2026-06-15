// Supabase Edge Function — Document Processing Worker
// Drains the pgmq 'document_processing' queue:
//   download PDF → OCR/extract → chunk → embed → store ccr_chunks
// Called by the upload API route (fire-and-forget) and by pg_cron (1 min interval).

import { createClient } from 'npm:@supabase/supabase-js@2'
import OpenAI from 'npm:openai@4'
import { extractText, getDocumentProxy } from 'npm:unpdf@0.11'
import { generateText } from 'npm:ai@4'
import { anthropic } from 'npm:@ai-sdk/anthropic@1'

// ============================================================
// Types
// ============================================================

interface QueueMessage {
  msg_id: number
  read_ct: number
  enqueued_at: string
  vt: string
  message: {
    document_id: string
    hoa_id: string
    storage_path: string
  }
}

interface ChunkMetadata {
  article: string | null
  section: string | null
  subsection: string | null
  page_numbers: number[]
  section_type: string
  hierarchy_path: string
  is_ocr: boolean
}

interface DocumentChunk {
  content: string
  embed_content: string
  section_title: string | null
  chunk_index: number
  metadata: ChunkMetadata
}

// ============================================================
// Configuration
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!

const QUEUE_NAME = 'document_processing'
const BATCH_SIZE = 3             // messages dequeued per invocation
const VISIBILITY_TIMEOUT = 600   // 10 min — prevents duplicate processing for large OCR PDFs
const INSERT_BATCH = 50          // chunks per DB insert
const EMBED_RETRY_ATTEMPTS = 3
const OVERLAP_CHARS = 400        // ~100 tokens of overlap between adjacent chunks
const EMBED_RETRY_BASE_MS = 1000  // doubles each attempt: 1s, 2s, 4s
const OCR_PAGE_LIMIT = 80     // max pages per OCR call; larger docs are split
const OCR_BLOCK_SIZE = 40     // pages per Claude OCR request

// Same constants as document-processor.ts
const SCANNED_PAGE_THRESHOLD = 50
const TARGET_TOKENS = 500
const MAX_TOKENS = 650
const CHARS_PER_TOKEN = 4
const ARTICLE_RE = /^ARTICLE\s+([IVXLCDM]+|\d+)[.:\s]\s*(.*)/i
const SECTION_RE = /^(?:SECTION|Section|SEC\.?)\s+(\d+(?:\.\d+)*)[.:)]\s*(.*)/
const SUBSECTION_RE = /^\s*\(([a-zA-Z])\)\s+/

// ============================================================
// Entry Point
// ============================================================

Deno.serve(async (req: Request) => {
  // Verify caller is authorized (service role or pg_cron)
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== SERVICE_ROLE_KEY) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

  const startTime = Date.now()

  try {
    await drainQueue(supabase, openai, startTime)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[process-document] Fatal error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// ============================================================
// Queue Draining
// ============================================================

async function drainQueue(
  supabase: ReturnType<typeof createClient>,
  openai: OpenAI,
  startTime: number
): Promise<void> {
  // Dequeue a batch of messages
  const { data: messages, error } = await supabase.rpc('pgmq_read', {
    queue_name: QUEUE_NAME,
    sleep_seconds: VISIBILITY_TIMEOUT,
    n: BATCH_SIZE,
  }) as { data: QueueMessage[] | null; error: unknown }

  if (error) {
    console.error('[process-document] Failed to read queue:', error)
    return
  }

  if (!messages || messages.length === 0) return

  // Process each message sequentially to avoid overwhelming OpenAI/Claude
  for (const msg of messages) {
    await processMessage(supabase, openai, msg)
  }

  // Self-recurse if queue has more work and we have time budget (< 100s elapsed)
  const elapsed = (Date.now() - startTime) / 1000
  if (elapsed < 100 && messages.length === BATCH_SIZE) {
    await drainQueue(supabase, openai, startTime)
  }
}

// ============================================================
// Message Processing
// ============================================================

async function processMessage(
  supabase: ReturnType<typeof createClient>,
  openai: OpenAI,
  msg: QueueMessage
): Promise<void> {
  const { document_id, hoa_id, storage_path } = msg.message

  console.log(`[process-document] Processing doc ${document_id}`)

  // Mark as processing
  await supabase
    .from('ccr_documents')
    .update({ status: 'processing' })
    .eq('id', document_id)

  try {
    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('ccr-documents')
      .download(storage_path)

    if (downloadError || !fileData) {
      throw new Error(`Storage download failed: ${downloadError?.message}`)
    }

    const pdfBuffer = await fileData.arrayBuffer()

    // Extract text / OCR
    const { pages, isOcr, ocrPageCount } = await extractPages(pdfBuffer)

    // Parse hierarchy and chunk
    const sections = parseHierarchy(pages)
    const allChunks: DocumentChunk[] = []
    for (const section of sections) {
      allChunks.push(...chunkSection(section, isOcr))
    }
    allChunks.forEach((c, i) => { c.chunk_index = i })

    // Inject overlap into embed_content (enriches retrieval without polluting display content)
    for (let i = 1; i < allChunks.length; i++) {
      const overlapText = allChunks[i - 1].content.slice(-OVERLAP_CHARS)
      if (overlapText) {
        allChunks[i].embed_content = overlapText + '\n' + allChunks[i].embed_content
      }
    }

    // Embed all chunks in a single batched API call (OpenAI supports up to 2048 inputs)
    const embeddings = await embedBatch(openai, allChunks.map(c => c.embed_content))

    // Bulk insert in batches
    for (let i = 0; i < allChunks.length; i += INSERT_BATCH) {
      const batchChunks = allChunks.slice(i, i + INSERT_BATCH)
      const rows = batchChunks.map((chunk, j) => ({
        hoa_id,
        document_id,
        content: chunk.content,
        section_title: chunk.section_title,
        embedding: embeddings[i + j],
        chunk_index: chunk.chunk_index,
        metadata: chunk.metadata,
      }))

      const { error: insertError } = await supabase.from('ccr_chunks').insert(rows)
      if (insertError) throw new Error(`Chunk insert failed: ${insertError.message}`)
    }

    // Mark completed
    await supabase
      .from('ccr_documents')
      .update({
        status: 'completed',
        page_count: pages.length,
        chunk_count: allChunks.length,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', document_id)

    // Ack the message
    await supabase.rpc('pgmq_delete', { queue_name: QUEUE_NAME, msg_id: msg.msg_id })

    console.log(`[process-document] Done: ${allChunks.length} chunks, ${pages.length} pages, OCR=${isOcr}`)
  } catch (err) {
    console.error(`[process-document] Failed doc ${document_id}:`, err)

    await supabase
      .from('ccr_documents')
      .update({
        status: 'failed',
        error_message: String(err).slice(0, 500),
      })
      .eq('id', document_id)

    // Delete message to avoid infinite poison-pill retries
    await supabase.rpc('pgmq_delete', { queue_name: QUEUE_NAME, msg_id: msg.msg_id })
  }
}

// ============================================================
// PDF Extraction + OCR (inlined from document-processor.ts logic)
// ============================================================

interface PageContent {
  pageNumber: number
  text: string
  isImageOnly: boolean
}

async function extractPages(
  pdfBuffer: ArrayBuffer
): Promise<{ pages: PageContent[]; isOcr: boolean; ocrPageCount: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer))
  const { text: pageTexts } = await extractText(pdf, { mergePages: false })

  let pages: PageContent[] = pageTexts.map((text, idx) => ({
    pageNumber: idx + 1,
    text,
    isImageOnly: text.trim().length < SCANNED_PAGE_THRESHOLD,
  }))

  const imageOnlyCount = pages.filter(p => p.isImageOnly).length
  const scannedRatio = imageOnlyCount / Math.max(pages.length, 1)
  const isOcr = scannedRatio > 0.3

  if (isOcr) {
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(pdfBuffer))
    )

    let allOcrLines: string[] = []

    if (pages.length <= OCR_PAGE_LIMIT) {
      // Single OCR call for smaller documents
      const { text: ocrText } = await ocrPageRange(base64, 1, pages.length)
      allOcrLines = ocrText.split('\n')
    } else {
      // Split into blocks to avoid output token overflow (Haiku max = 8192 tokens)
      for (let start = 1; start <= pages.length; start += OCR_BLOCK_SIZE) {
        const end = Math.min(start + OCR_BLOCK_SIZE - 1, pages.length)
        const { text: blockText } = await ocrPageRange(base64, start, end)
        allOcrLines.push(...blockText.split('\n'))
        console.log(`[process-document] OCR block pages ${start}-${end} done`)
      }
    }

    const linesPerPage = Math.max(1, Math.ceil(allOcrLines.length / pages.length))
    pages = pages.map((page, idx) => ({
      ...page,
      text: allOcrLines.slice(idx * linesPerPage, (idx + 1) * linesPerPage).join('\n'),
      isImageOnly: false,
    }))

    return { pages, isOcr: true, ocrPageCount: imageOnlyCount }
  }

  return { pages, isOcr: false, ocrPageCount: 0 }
}

async function ocrPageRange(
  base64Pdf: string,
  startPage: number,
  endPage: number
): Promise<{ text: string }> {
  const rangeNote = startPage === endPage
    ? `page ${startPage}`
    : `pages ${startPage} through ${endPage}`
  return generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'file' as const, data: base64Pdf, mimeType: 'application/pdf' as const },
          {
            type: 'text' as const,
            text: `Extract the text from ${rangeNote} of this document verbatim. Preserve article and section headings exactly as written. Output only the extracted text.`,
          },
        ],
      },
    ],
    maxTokens: 8192,
  })
}

// ============================================================
// Hierarchy Parsing (mirrored from document-processor.ts)
// ============================================================

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

function parseHierarchy(pages: PageContent[]): HierarchicalSection[] {
  const lines = pages.flatMap(p => p.text.split('\n'))
  const sections: HierarchicalSection[] = []
  let curArticle: string | null = null
  let curSection: string | null = null
  let curSubsection: string | null = null
  let curTitle: string | null = null
  let curType: ChunkMetadata['section_type'] = 'body'
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
// Chunking (mirrored from document-processor.ts)
// ============================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/([.?!])\s+(?=[A-Z])/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}

function chunkSection(section: HierarchicalSection, isOcr: boolean): DocumentChunk[] {
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
    pending = []
    pendingTokens = 0
  }

  for (const sentence of sentences) {
    const sentTokens = estimateTokens(sentence)

    if (sentTokens > MAX_TOKENS) {
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

    if (pendingTokens + sentTokens > MAX_TOKENS && pending.length > 0) flush()

    pending.push(sentence)
    pendingTokens += sentTokens
    if (pendingTokens >= TARGET_TOKENS) flush()
  }

  flush()
  return chunks
}

// ============================================================
// Helpers
// ============================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = EMBED_RETRY_ATTEMPTS,
  baseDelayMs = EMBED_RETRY_BASE_MS
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxAttempts) throw err
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1)))
    }
  }
  throw new Error('unreachable')
}

// ============================================================
// Embedding — batched for efficiency
// OpenAI supports up to 2048 inputs per call; embeddings are returned in input order.
// ============================================================

async function embedBatch(openai: OpenAI, texts: string[]): Promise<number[][]> {
  const MAX_BATCH = 2048
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH)
    const response = await withRetry(() =>
      openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
        dimensions: 1536,
      })
    )
    results.push(...response.data.map(d => d.embedding))
  }
  return results
}
