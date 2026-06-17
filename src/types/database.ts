export type UserRole = 'resident' | 'admin'
export type ResidentStatus = 'active' | 'invited' | 'inactive'
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type WorkOrderStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent'
export type BookingStatus = 'confirmed' | 'cancelled'
export type ComplaintCategory = 'noise' | 'parking' | 'property' | 'neighbor' | 'maintenance' | 'other'
export type ComplaintStatus = 'open' | 'under_review' | 'resolved' | 'closed'
export type ViolationStatus = 'draft' | 'issued' | 'appealed' | 'resolved' | 'closed'
export type MessageRole = 'user' | 'assistant' | 'tool'
export type AnnouncementStatus = 'draft' | 'published'

export interface Database {
  public: {
    Tables: {
      hoas: {
        Row: {
          id: string
          name: string
          address: string | null
          subdomain: string
          logo_url: string | null
          city: string | null
          state: string
          phone: string | null
          website: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          subdomain: string
          logo_url?: string | null
          city?: string | null
          state?: string
          phone?: string | null
          website?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          subdomain?: string
          logo_url?: string | null
          city?: string | null
          state?: string
          phone?: string | null
          website?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          hoa_id: string
          role: UserRole
          full_name: string | null
          unit_number: string | null
          phone: string | null
          avatar_url: string | null
          email: string | null
          is_active: boolean
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          hoa_id: string
          role?: UserRole
          full_name?: string | null
          unit_number?: string | null
          phone?: string | null
          avatar_url?: string | null
          email?: string | null
          is_active?: boolean
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          role?: UserRole
          full_name?: string | null
          unit_number?: string | null
          phone?: string | null
          avatar_url?: string | null
          email?: string | null
          is_active?: boolean
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      resident_invitations: {
        Row: {
          id: string
          hoa_id: string
          email: string
          full_name: string | null
          unit_number: string | null
          phone: string | null
          role: UserRole
          invitation_token: string
          invited_by: string
          invited_at: string
          expires_at: string
          accepted_at: string | null
          external_id: string | null
          external_source: string | null
        }
        Insert: {
          id?: string
          hoa_id: string
          email: string
          full_name?: string | null
          unit_number?: string | null
          phone?: string | null
          role?: UserRole
          invitation_token?: string
          invited_by: string
          invited_at?: string
          expires_at?: string
          accepted_at?: string | null
          external_id?: string | null
          external_source?: string | null
        }
        Update: {
          id?: string
          hoa_id?: string
          email?: string
          full_name?: string | null
          unit_number?: string | null
          phone?: string | null
          role?: UserRole
          invitation_token?: string
          invited_by?: string
          invited_at?: string
          expires_at?: string
          accepted_at?: string | null
          external_id?: string | null
          external_source?: string | null
        }
      }
      crm_integrations: {
        Row: {
          id: string
          hoa_id: string
          provider: string
          credentials: Record<string, unknown>
          sync_config: Record<string, unknown>
          last_synced_at: string | null
          status: 'active' | 'paused' | 'error'
          created_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          provider: string
          credentials?: Record<string, unknown>
          sync_config?: Record<string, unknown>
          last_synced_at?: string | null
          status?: 'active' | 'paused' | 'error'
          created_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          provider?: string
          credentials?: Record<string, unknown>
          sync_config?: Record<string, unknown>
          last_synced_at?: string | null
          status?: 'active' | 'paused' | 'error'
          created_at?: string
        }
      }
      ccr_documents: {
        Row: {
          id: string
          hoa_id: string
          filename: string
          storage_path: string
          uploaded_by: string
          status: DocumentStatus
          page_count: number | null
          chunk_count: number | null
          error_message: string | null
          processed_at: string | null
          created_at: string
          last_queued_at: string | null
          embedding_tokens: number
          ocr_tokens: number
        }
        Insert: {
          id?: string
          hoa_id: string
          filename: string
          storage_path: string
          uploaded_by: string
          status?: DocumentStatus
          page_count?: number | null
          chunk_count?: number | null
          error_message?: string | null
          processed_at?: string | null
          created_at?: string
          last_queued_at?: string | null
          embedding_tokens?: number
          ocr_tokens?: number
        }
        Update: {
          id?: string
          hoa_id?: string
          filename?: string
          storage_path?: string
          uploaded_by?: string
          status?: DocumentStatus
          page_count?: number | null
          chunk_count?: number | null
          error_message?: string | null
          processed_at?: string | null
          created_at?: string
          last_queued_at?: string | null
          embedding_tokens?: number
          ocr_tokens?: number
        }
      }
      ccr_chunks: {
        Row: {
          id: string
          hoa_id: string
          document_id: string
          content: string
          section_title: string | null
          embedding: number[] | null
          chunk_index: number
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          document_id: string
          content: string
          section_title?: string | null
          embedding?: number[] | null
          chunk_index: number
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          document_id?: string
          content?: string
          section_title?: string | null
          embedding?: number[] | null
          chunk_index?: number
          metadata?: Record<string, unknown>
          created_at?: string
        }
      }
      work_orders: {
        Row: {
          id: string
          hoa_id: string
          submitted_by: string
          title: string
          description: string
          status: WorkOrderStatus
          priority: WorkOrderPriority
          photo_urls: string[]
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          submitted_by: string
          title: string
          description: string
          status?: WorkOrderStatus
          priority?: WorkOrderPriority
          photo_urls?: string[]
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          submitted_by?: string
          title?: string
          description?: string
          status?: WorkOrderStatus
          priority?: WorkOrderPriority
          photo_urls?: string[]
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      amenities: {
        Row: {
          id: string
          hoa_id: string
          name: string
          description: string | null
          capacity: number | null
          rules: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          name: string
          description?: string | null
          capacity?: number | null
          rules?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          name?: string
          description?: string | null
          capacity?: number | null
          rules?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          hoa_id: string
          amenity_id: string
          resident_id: string
          date: string
          start_time: string
          end_time: string
          status: BookingStatus
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          amenity_id: string
          resident_id: string
          date: string
          start_time: string
          end_time: string
          status?: BookingStatus
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          amenity_id?: string
          resident_id?: string
          date?: string
          start_time?: string
          end_time?: string
          status?: BookingStatus
          notes?: string | null
          created_at?: string
        }
      }
      complaints: {
        Row: {
          id: string
          hoa_id: string
          submitted_by: string
          subject: string
          description: string
          category: ComplaintCategory
          status: ComplaintStatus
          admin_notes: string | null
          evidence_urls: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          submitted_by: string
          subject: string
          description: string
          category?: ComplaintCategory
          status?: ComplaintStatus
          admin_notes?: string | null
          evidence_urls?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          submitted_by?: string
          subject?: string
          description?: string
          category?: ComplaintCategory
          status?: ComplaintStatus
          admin_notes?: string | null
          evidence_urls?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      violations: {
        Row: {
          id: string
          hoa_id: string
          resident_id: string | null
          reported_by: string
          resident_unit: string | null
          description: string
          rule_reference: string | null
          photo_urls: string[]
          status: ViolationStatus
          fine_amount: number | null
          formal_notice: string | null
          issued_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          resident_id?: string | null
          reported_by: string
          resident_unit?: string | null
          description: string
          rule_reference?: string | null
          photo_urls?: string[]
          status?: ViolationStatus
          fine_amount?: number | null
          formal_notice?: string | null
          issued_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          resident_id?: string | null
          reported_by?: string
          resident_unit?: string | null
          description?: string
          rule_reference?: string | null
          photo_urls?: string[]
          status?: ViolationStatus
          fine_amount?: number | null
          formal_notice?: string | null
          issued_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          hoa_id: string
          profile_id: string
          created_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          profile_id: string
          created_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          profile_id?: string
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          hoa_id: string
          role: MessageRole
          content: string
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          hoa_id: string
          role: MessageRole
          content: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          hoa_id?: string
          role?: MessageRole
          content?: string
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
      }
      announcements: {
        Row: {
          id: string
          hoa_id: string
          created_by: string
          subject: string
          body: string
          status: AnnouncementStatus
          send_email: boolean
          send_sms: boolean
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          created_by: string
          subject: string
          body: string
          status?: AnnouncementStatus
          send_email?: boolean
          send_sms?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          created_by?: string
          subject?: string
          body?: string
          status?: AnnouncementStatus
          send_email?: boolean
          send_sms?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      rag_query_logs: {
        Row: {
          id: string
          hoa_id: string
          user_id: string | null
          query_text: string
          match_count: number
          top_section_title: string | null
          avg_similarity: number | null
          had_results: boolean
          created_at: string
        }
        Insert: {
          id?: string
          hoa_id: string
          user_id?: string | null
          query_text: string
          match_count: number
          top_section_title?: string | null
          avg_similarity?: number | null
          had_results: boolean
          created_at?: string
        }
        Update: {
          id?: string
          hoa_id?: string
          user_id?: string | null
          query_text?: string
          match_count?: number
          top_section_title?: string | null
          avg_similarity?: number | null
          had_results?: boolean
          created_at?: string
        }
      }
    }
    Functions: {
      my_hoa_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      my_role: {
        Args: Record<PropertyKey, never>
        Returns: 'resident' | 'admin'
      }
      match_ccr_chunks: {
        Args: {
          query_embedding: unknown
          query_text: string
          match_threshold: number
          match_count: number
          p_hoa_id: string
          rrf_k?: number
        }
        Returns: Array<{
          id: string
          content: string
          section_title: string | null
          metadata: Record<string, unknown>
          similarity: number
        }>
      }
      match_ccr_chunks_with_context: {
        Args: {
          query_embedding: unknown
          query_text: string
          match_threshold: number
          match_count: number
          p_hoa_id: string
          rrf_k?: number
        }
        Returns: Array<{
          id: string
          content: string
          prev_content: string | null
          next_content: string | null
          section_title: string | null
          metadata: Record<string, unknown>
          similarity: number
        }>
      }
      enqueue_document_processing: {
        Args: {
          p_document_id: string
          p_hoa_id: string
          p_storage_path: string
        }
        Returns: number
      }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: Array<{
          id: string
          hoa_id: string
          email: string
          full_name: string | null
          unit_number: string | null
          phone: string | null
          role: UserRole
          expires_at: string
          hoa_name: string
          hoa_subdomain: string
        }>
      }
    }
    Enums: {
      user_role: 'resident' | 'admin'
      document_status: 'pending' | 'processing' | 'completed' | 'failed'
      work_order_status: 'open' | 'in_progress' | 'resolved' | 'closed'
      work_order_priority: 'low' | 'medium' | 'high' | 'urgent'
      booking_status: 'confirmed' | 'cancelled'
      complaint_category: 'noise' | 'parking' | 'property' | 'neighbor' | 'maintenance' | 'other'
      complaint_status: 'open' | 'under_review' | 'resolved' | 'closed'
      violation_status: 'draft' | 'issued' | 'appealed' | 'resolved' | 'closed'
      message_role: 'user' | 'assistant' | 'tool'
      announcement_status: 'draft' | 'published'
    }
    Views: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience row types
export type Hoa = Database['public']['Tables']['hoas']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type CcrDocument = Database['public']['Tables']['ccr_documents']['Row']
export type CcrChunk = Database['public']['Tables']['ccr_chunks']['Row']
export type WorkOrder = Database['public']['Tables']['work_orders']['Row']
export type Amenity = Database['public']['Tables']['amenities']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type Complaint = Database['public']['Tables']['complaints']['Row']
export type Violation = Database['public']['Tables']['violations']['Row']
export type ChatSession = Database['public']['Tables']['chat_sessions']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
export type Announcement = Database['public']['Tables']['announcements']['Row']
export type RagQueryLog = Database['public']['Tables']['rag_query_logs']['Row']
export type ResidentInvitation = Database['public']['Tables']['resident_invitations']['Row']
export type CrmIntegration = Database['public']['Tables']['crm_integrations']['Row']
