'use client'

import { useChat } from 'ai/react'
import { useRef, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types/database'
import type { Message } from 'ai'
import {
  SendHorizonal,
  Paperclip,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Calendar,
  ClipboardList,
  MessageSquareWarning,
} from 'lucide-react'

interface ChatInterfaceProps {
  profile: Profile
  sessionId: string
  initialMessages?: Message[]
}

interface ToolResultData {
  success?: boolean
  error?: string
  message?: string
  bookingId?: string
  workOrderId?: string
  complaintId?: string
  violationId?: string
  found?: boolean
  results?: Array<{ section: string; content: string; relevance: number }>
  amenities?: Array<{ id: string; name: string; description: string | null }>
  workOrders?: Array<{ id: string; title: string; status: string; priority: string }>
  bookings?: Array<{ id: string; date: string; start_time: string; end_time: string }>
  existingBookings?: Array<{ startTime: string; endTime: string }>
  available?: boolean
  date?: string
  startTime?: string
  endTime?: string
}

function ToolResultCard({ toolName, result }: { toolName: string; result: ToolResultData }) {
  if (toolName === 'searchHOARules') {
    if (!result.found) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">No matching rules found</p>
          <p className="text-xs mt-1 text-amber-700">{result.message}</p>
        </div>
      )
    }
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
          Rules & CC&Rs
        </p>
        {result.results?.slice(0, 3).map((r, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium text-blue-900">{r.section}</span>
            <p className="text-blue-800 mt-0.5 text-xs leading-relaxed line-clamp-3">{r.content}</p>
          </div>
        ))}
      </div>
    )
  }

  if (toolName === 'bookAmenity') {
    if (!result.success) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{result.error}</span>
        </div>
      )
    }
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
        <div>
          <p className="font-medium">Booking Confirmed</p>
          <p className="text-xs text-green-700 mt-0.5">
            {result.date} · {result.startTime} – {result.endTime}
          </p>
        </div>
        <Calendar className="h-4 w-4 ml-auto text-green-500 shrink-0" />
      </div>
    )
  }

  if (toolName === 'submitWorkOrder') {
    if (!result.success) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{result.error}</span>
        </div>
      )
    }
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
        <div>
          <p className="font-medium">Work Order Submitted</p>
          <p className="text-xs text-green-700 mt-0.5">{result.message}</p>
        </div>
        <Wrench className="h-4 w-4 ml-auto text-green-500 shrink-0" />
      </div>
    )
  }

  if (toolName === 'fileComplaint') {
    if (!result.success) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{result.error}</span>
        </div>
      )
    }
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
        <div>
          <p className="font-medium">Complaint Filed</p>
          <p className="text-xs text-green-700 mt-0.5">{result.message}</p>
        </div>
        <ClipboardList className="h-4 w-4 ml-auto text-green-500 shrink-0" />
      </div>
    )
  }

  if (toolName === 'createViolation') {
    if (!result.success) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{result.error}</span>
        </div>
      )
    }
    return (
      <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
        <MessageSquareWarning className="h-4 w-4 mt-0.5 shrink-0 text-orange-600" />
        <div>
          <p className="font-medium">Violation Recorded</p>
          <p className="text-xs text-orange-700 mt-0.5">{result.message}</p>
        </div>
      </div>
    )
  }

  // Generic success/error fallback
  if (result.success === false) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{result.error ?? 'An error occurred.'}</span>
      </div>
    )
  }

  return null
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-slate-200 text-slate-600'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}>
        {message.parts?.map((part, i) => {
          if (part.type === 'text' && part.text) {
            return (
              <div
                key={i}
                className={cn(
                  'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm'
                )}
              >
                <p className="whitespace-pre-wrap">{part.text}</p>
              </div>
            )
          }

          if (part.type === 'tool-invocation') {
            const inv = part.toolInvocation
            if (inv.state === 'result') {
              const card = (
                <ToolResultCard
                  toolName={inv.toolName}
                  result={inv.result as ToolResultData}
                />
              )
              if (!card) return null
              return <div key={i}>{card}</div>
            }
            // Tool call in progress
            return (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Processing…</span>
              </div>
            )
          }

          return null
        }) ?? (
          <div
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              isUser
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm'
            )}
          >
            <p className="whitespace-pre-wrap">{typeof message.content === 'string' ? message.content : ''}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatInterface({ profile, sessionId, initialMessages = [] }: ChatInterfaceProps) {
  const apiRoute = profile.role === 'admin' ? '/api/agent/admin' : '/api/agent/resident'
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: apiRoute,
    initialMessages,
    body: { sessionId },
    onFinish: async () => {
      const supabase = createClient()
      const lastUserMessage = messages[messages.length - 1]
      if (lastUserMessage?.role === 'user') {
        const { error } = await supabase.from('chat_messages').insert({
          session_id: sessionId,
          hoa_id: profile.hoa_id,
          role: 'user',
          content: typeof lastUserMessage.content === 'string' ? lastUserMessage.content : '',
        })
        if (error) toast.error('Não foi possível salvar a mensagem')
      }
    },
  })

  useEffect(() => {
    if (!sessionId) toast.error('Erro ao iniciar sessão de chat')
  }, [sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    const supabase = createClient()
    const urls: string[] = []

    for (const file of files) {
      const path = `${profile.hoa_id}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage
        .from('incident-photos')
        .upload(path, file, { upsert: false })

      if (error) {
        toast.error(`Falha ao enviar ${file.name}`)
      } else {
        const { data } = supabase.storage.from('incident-photos').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    }

    setAttachmentUrls((prev) => [...prev, ...urls])
    setUploading(false)
    e.target.value = ''
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!input.trim() && attachmentUrls.length === 0) return

    let messageText = input
    if (attachmentUrls.length > 0) {
      const urlList = attachmentUrls.map((u) => `[Photo: ${u}]`).join(' ')
      messageText = messageText ? `${messageText}\n\n${urlList}` : urlList
    }

    setInput(messageText)
    setAttachmentUrls([])
    handleSubmit(e)
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Messages area */}
      <ScrollArea className="flex-1 px-4 py-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-center px-4 py-12">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">
              Hi{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! How can I help?
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ask about HOA rules, book amenities, submit a work order, or file a complaint.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-6 w-full max-w-sm">
              {[
                { label: 'Ask about rules', prompt: 'What are the rules for the community pool?' },
                { label: 'Book amenity', prompt: 'I want to book the clubhouse for this weekend.' },
                { label: 'Submit work order', prompt: 'There is a leaking pipe in the hallway on floor 2.' },
                { label: 'File a complaint', prompt: 'I want to file a noise complaint about my neighbor.' },
              ].map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => setInput(suggestion.prompt)}
                  className="text-left text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-700 shadow-sm"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4 pb-2">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200">
                <Bot className="h-4 w-4 text-slate-600" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Attachment preview */}
      {attachmentUrls.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {attachmentUrls.map((url, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Attachment ${i + 1}`}
                className="h-16 w-16 object-cover rounded-lg border border-slate-200"
              />
              <button
                type="button"
                onClick={() => setAttachmentUrls((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 w-4 h-4 bg-slate-900 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-500 hover:text-slate-700"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach photo"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Message your HOA assistant…"
            className="flex-1 resize-none rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 rounded-xl"
            disabled={isLoading || (!input.trim() && attachmentUrls.length === 0)}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
