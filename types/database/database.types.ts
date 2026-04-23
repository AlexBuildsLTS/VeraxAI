export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          ai_model: string
          chapters: Json
          conclusion: string | null
          created_at: string
          id: string
          key_takeaways: Json
          language: string
          processed_at: string | null
          seo_metadata: Json
          summary: string | null
          tokens_used: number | null
          updated_at: string
          video_id: string
        }
        Insert: {
          ai_model?: string
          chapters?: Json
          conclusion?: string | null
          created_at?: string
          id?: string
          key_takeaways?: Json
          language?: string
          processed_at?: string | null
          seo_metadata?: Json
          summary?: string | null
          tokens_used?: number | null
          updated_at?: string
          video_id: string
        }
        Update: {
          ai_model?: string
          chapters?: Json
          conclusion?: string | null
          created_at?: string
          id?: string
          key_takeaways?: Json
          language?: string
          processed_at?: string | null
          seo_metadata?: Json
          summary?: string | null
          tokens_used?: number | null
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_jobs: {
        Row: {
          completed_videos: number
          created_at: string
          failed_videos: number
          id: string
          name: string
          status: string
          total_videos: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_videos?: number
          created_at?: string
          failed_videos?: number
          id?: string
          name: string
          status?: string
          total_videos?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_videos?: number
          created_at?: string
          failed_videos?: number
          id?: string
          name?: string
          status?: string
          total_videos?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          avatar_url: string | null
          banned_until: string | null
          biometrics_enabled: boolean | null
          created_at: string
          custom_api_key: string | null
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          tokens_balance: number
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          avatar_url?: string | null
          banned_until?: string | null
          biometrics_enabled?: boolean | null
          created_at?: string
          custom_api_key?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          tokens_balance?: number
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          avatar_url?: string | null
          banned_until?: string | null
          biometrics_enabled?: boolean | null
          created_at?: string
          custom_api_key?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          tokens_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_api_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string
          id: string
          key_preview: string
          name: string
          status: string | null
          tokens_burned: number | null
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          id?: string
          key_preview: string
          name: string
          status?: string | null
          tokens_burned?: number | null
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          id?: string
          key_preview?: string
          name?: string
          status?: string | null
          tokens_burned?: number | null
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          attachment_url: string | null
          created_at: string
          id: string
          is_internal: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          category: string
          created_at: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          confidence_score: number | null
          created_at: string
          extraction_method: string | null
          id: string
          language_code: string
          reading_time_minutes: number | null
          transcript_json: Json | null
          transcript_text: string
          video_id: string
          word_count: number | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          extraction_method?: string | null
          id?: string
          language_code?: string
          reading_time_minutes?: number | null
          transcript_json?: Json | null
          transcript_text: string
          video_id: string
          word_count?: number | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          extraction_method?: string | null
          id?: string
          language_code?: string
          reading_time_minutes?: number | null
          transcript_json?: Json | null
          transcript_text?: string
          video_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          action: string
          ai_model: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          metadata: Json | null
          tokens_consumed: number | null
          user_id: string
          video_id: string | null
        }
        Insert: {
          action: string
          ai_model?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          tokens_consumed?: number | null
          user_id: string
          video_id?: string | null
        }
        Update: {
          action?: string
          ai_model?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          metadata?: Json | null
          tokens_consumed?: number | null
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          audio_url: string | null
          batch_job_id: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: string
          last_retry_at: string | null
          platform: string | null
          processing_completed_at: string | null
          processing_duration_ms: number | null
          processing_provider: string | null
          processing_started_at: string | null
          retry_count: number | null
          status: Database["public"]["Enums"]["video_status"]
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          youtube_url: string
          youtube_video_id: string | null
        }
        Insert: {
          audio_url?: string | null
          batch_job_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          platform?: string | null
          processing_completed_at?: string | null
          processing_duration_ms?: number | null
          processing_provider?: string | null
          processing_started_at?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["video_status"]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          youtube_url: string
          youtube_video_id?: string | null
        }
        Update: {
          audio_url?: string | null
          batch_job_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          platform?: string | null
          processing_completed_at?: string | null
          processing_duration_ms?: number | null
          processing_provider?: string | null
          processing_started_at?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["video_status"]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          youtube_url?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_batch_job_id_fkey"
            columns: ["batch_job_id"]
            isOneToOne: false
            referencedRelation: "batch_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_role: {
        Args: { new_role: string; target_user_id: string }
        Returns: undefined
      }
      check_is_admin: { Args: never; Returns: boolean }
      get_daily_token_usage: {
        Args: { days_back?: number }
        Returns: {
          total_requests: number
          total_tokens: number
          usage_date: string
        }[]
      }
      get_daily_usage_by_key: {
        Args: { days_back?: number }
        Returns: {
          api_key_name: string
          total_tokens: number
          usage_date: string
        }[]
      }
      get_monthly_usage_by_key: {
        Args: { months_back?: number }
        Returns: {
          api_key_name: string
          total_tokens: number
          usage_month: string
        }[]
      }
      get_my_workspace_ids: { Args: never; Returns: string[] }
      increment_key_burn: {
        Args: { key_id: string; token_amount: number }
        Returns: undefined
      }
      increment_workspace_usage: {
        Args: { p_minutes: number; p_workspace_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      reset_monthly_usage: { Args: never; Returns: undefined }
      search_transcripts: {
        Args: { search_query: string; workspace_filter?: string }
        Returns: {
          relevance: number
          snippet: string
          video_id: string
          video_title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      user_role: "member" | "premium" | "support" | "admin"
      video_status:
      | "idle"
      | "queued"
      | "downloading"
      | "transcribing"
      | "ai_processing"
      | "completed"
      | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["member", "premium", "support", "admin"],
      video_status: [
        "idle",
        "queued",
        "downloading",
        "transcribing",
        "ai_processing",
        "completed",
        "failed",
      ],
    },
  },
} as const
