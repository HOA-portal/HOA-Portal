import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { extractText, getDocumentProxy } from 'unpdf'

// Re-export shared types and pure utilities so callers only need one import.
export type { StatementLineItem, ParsedStatement } from './financial-parser-types'
export { matchCategoryHint } from './financial-parser-types'
import type { ParsedStatement } from './financial-parser-types'

const SCANNED_PAGE_THRESHOLD = 50

export async function parseFinancialStatementPDF(
  pdfBuffer: ArrayBuffer,
): Promise<ParsedStatement> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer))
  const { text: pageTexts } = await extractText(pdf, { mergePages: false })

  const pages = (pageTexts as string[]).map((text, idx) => ({
    pageNumber: idx + 1,
    text,
    isImageOnly: text.trim().length < SCANNED_PAGE_THRESHOLD,
  }))

  const isScanned = pages.length > 0 && pages.filter(p => p.isImageOnly).length / pages.length > 0.3

  let fullText: string
  if (isScanned && process.env.ANTHROPIC_API_KEY) {
    fullText = await ocrPdfText(pdfBuffer)
  } else {
    fullText = pages.map(p => p.text).join('\n\n--- PAGE BREAK ---\n\n')
  }

  return extractStructuredData(fullText)
}

async function ocrPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
  const base64Pdf = bufferToBase64(pdfBuffer)
  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: base64Pdf,
            mimeType: 'application/pdf',
          },
          {
            type: 'text',
            text: 'Extract all text from this PDF verbatim. Preserve table structure using spaces or pipes. Output only the extracted text, no commentary.',
          },
        ],
      },
    ],
  })
  return text
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 32768
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

// Extracts the first complete JSON object from arbitrary text using a bracket counter.
// Safer than a greedy regex when Claude includes surrounding explanation.
function extractFirstJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

async function extractStructuredData(text: string): Promise<ParsedStatement> {
  const prompt = `You are parsing a HOA (Homeowners Association) financial statement PDF.

Extract financial data ONLY from the Income Statement or Cash Flow section (NOT from the Balance Sheet, Dues Roll, Work Orders, or vendor invoices).

Output ONLY the JSON object below — no explanation, no markdown, no code fences:
{
  "year": <integer, e.g. 2026>,
  "month": <integer 1-12, e.g. 4 for April>,
  "period_label": "<string, e.g. 'April 2026'>",
  "income": [
    { "name": "<line item name>", "amount": <number>, "category_hint": "<parent group name from PDF>" }
  ],
  "expenses": [
    { "name": "<line item name>", "amount": <number>, "category_hint": "<parent group name from PDF>" }
  ],
  "total_income": <number>,
  "total_expenses": <number>,
  "net_income": <number>,
  "confidence": "<high|medium|low>"
}

Rules:
- Include individual line items only (not subtotals/totals rows like "Total INSURANCE").
- Use the section header (e.g., "INSURANCE", "UTILITIES") as category_hint.
- All amounts must be positive numbers (expenses are already positive).
- Set confidence to "high" if you found clear income+expense sections with totals,
  "medium" if the structure was partially unclear, "low" if you had to guess.
- If you cannot find financial data, return { "error": "<reason>" }.

PDF text:
${text.slice(0, 12000)}`

  const { text: raw } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    messages: [{ role: 'user', content: prompt }],
  })

  const jsonStr = extractFirstJson(raw)
  if (!jsonStr) throw new Error('Claude did not return a JSON object')

  const parsed = JSON.parse(jsonStr)
  if (parsed.error) throw new Error(`Claude parsing error: ${parsed.error}`)

  return parsed as ParsedStatement
}
