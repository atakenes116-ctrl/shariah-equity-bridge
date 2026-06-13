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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      deals: {
        Row: {
          amount_requested: number
          bank_statements_file: string | null
          country: string
          created_at: string
          deadline: string | null
          equity_offered: number
          financial_statements_file: string | null
          flags: Json
          funded_amount: number
          funded_at: string | null
          id: string
          interest_bearing_debt: number
          interest_income: number
          investor_confirmed_receipt: boolean
          investor_id: string | null
          min_investment: number
          net_profit: number
          pitch: string
          platform_fee: number
          revenue: number
          review_note: string | null
          reviewed_by: string | null
          sector: string
          shariah_status: string
          sme_confirmed_equity: boolean
          sme_id: string
          sme_name: string
          status: Database["public"]["Enums"]["deal_status"]
          total_assets: number
          use_of_funds: string
          years_in_operation: number
        }
        Insert: {
          amount_requested: number
          bank_statements_file?: string | null
          country: string
          created_at?: string
          deadline?: string | null
          equity_offered: number
          financial_statements_file?: string | null
          flags?: Json
          funded_amount?: number
          funded_at?: string | null
          id?: string
          interest_bearing_debt?: number
          interest_income?: number
          investor_confirmed_receipt?: boolean
          investor_id?: string | null
          min_investment?: number
          net_profit?: number
          pitch?: string
          platform_fee?: number
          revenue?: number
          review_note?: string | null
          reviewed_by?: string | null
          sector: string
          shariah_status?: string
          sme_confirmed_equity?: boolean
          sme_id: string
          sme_name: string
          status?: Database["public"]["Enums"]["deal_status"]
          total_assets?: number
          use_of_funds?: string
          years_in_operation?: number
        }
        Update: {
          amount_requested?: number
          bank_statements_file?: string | null
          country?: string
          created_at?: string
          deadline?: string | null
          equity_offered?: number
          financial_statements_file?: string | null
          flags?: Json
          funded_amount?: number
          funded_at?: string | null
          id?: string
          interest_bearing_debt?: number
          interest_income?: number
          investor_confirmed_receipt?: boolean
          investor_id?: string | null
          min_investment?: number
          net_profit?: number
          pitch?: string
          platform_fee?: number
          revenue?: number
          review_note?: string | null
          reviewed_by?: string | null
          sector?: string
          shariah_status?: string
          sme_confirmed_equity?: boolean
          sme_id?: string
          sme_name?: string
          status?: Database["public"]["Enums"]["deal_status"]
          total_assets?: number
          use_of_funds?: string
          years_in_operation?: number
        }
        Relationships: []
      }
      investments: {
        Row: {
          amount: number
          created_at: string
          deadline: string
          deal_id: string
          dispute_reason: string | null
          equity_percent: number
          funded_at: string
          id: string
          investor_confirmed_receipt: boolean
          investor_id: string
          platform_fee: number
          sme_confirmed_equity: boolean
          status: Database["public"]["Enums"]["investment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          deadline?: string
          deal_id: string
          dispute_reason?: string | null
          equity_percent: number
          funded_at?: string
          id?: string
          investor_confirmed_receipt?: boolean
          investor_id: string
          platform_fee?: number
          sme_confirmed_equity?: boolean
          status?: Database["public"]["Enums"]["investment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deadline?: string
          deal_id?: string
          dispute_reason?: string | null
          equity_percent?: number
          funded_at?: string
          id?: string
          investor_confirmed_receipt?: boolean
          investor_id?: string
          platform_fee?: number
          sme_confirmed_equity?: boolean
          status?: Database["public"]["Enums"]["investment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          wallet_balance: number
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          wallet_balance?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          wallet_balance?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "sme" | "investor" | "admin"
      deal_status:
        | "draft"
        | "under_review"
        | "approved"
        | "rejected"
        | "funds_in_escrow"
        | "equity_confirmed"
        | "completed"
        | "refunded"
        | "disputed"
        | "partially_funded"
        | "fully_funded"
      investment_status:
        | "funds_in_escrow"
        | "equity_confirmed"
        | "completed"
        | "disputed"
        | "refunded"
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
      app_role: ["sme", "investor", "admin"],
      deal_status: [
        "draft",
        "under_review",
        "approved",
        "rejected",
        "funds_in_escrow",
        "equity_confirmed",
        "completed",
        "refunded",
        "disputed",
        "partially_funded",
        "fully_funded",
      ],
      investment_status: [
        "funds_in_escrow",
        "equity_confirmed",
        "completed",
        "disputed",
        "refunded",
      ],
    },
  },
} as const
