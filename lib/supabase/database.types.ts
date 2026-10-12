/**
 * Supabase Database Type Definitions
 * Includes core financial tables (categories, transactions, budgets)
 * and WhatsApp companion tables (user_settings, phone_verifications).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CategoryKind = 'income' | 'expense';
export type TransactionType = 'income' | 'expense';
export type TransactionSource = 'web' | 'whatsapp_text' | 'whatsapp_image';

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          kind: CategoryKind;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          kind: CategoryKind;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          kind?: CategoryKind;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: TransactionType;
          amount_paise: number;
          category_id: string | null;
          note: string | null;
          merchant: string | null;
          source: TransactionSource;
          whatsapp_message_id: string | null;
          raw_input: string | null;
          occurred_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: TransactionType;
          amount_paise: number;
          category_id?: string | null;
          note?: string | null;
          merchant?: string | null;
          source?: TransactionSource;
          whatsapp_message_id?: string | null;
          raw_input?: string | null;
          occurred_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: TransactionType;
          amount_paise?: number;
          category_id?: string | null;
          note?: string | null;
          merchant?: string | null;
          source?: TransactionSource;
          whatsapp_message_id?: string | null;
          raw_input?: string | null;
          occurred_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_transactions_category_composite';
            columns: ['user_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['user_id', 'id'];
          },
          {
            foreignKeyName: 'transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          monthly_limit_paise: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          monthly_limit_paise: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          monthly_limit_paise?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budgets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_budgets_category_composite';
            columns: ['user_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['user_id', 'id'];
          }
        ];
      };
      user_settings: {
        Row: {
          user_id: string;
          phone_number: string | null;
          phone_verified: boolean;
          monthly_budget_paise: number | null;
          currency: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          phone_number?: string | null;
          phone_verified?: boolean;
          monthly_budget_paise?: number | null;
          currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          phone_number?: string | null;
          phone_verified?: boolean;
          monthly_budget_paise?: number | null;
          currency?: string;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      phone_verifications: {
        Row: {
          id: string;
          user_id: string;
          phone_number: string;
          otp_code: string;
          attempts: number;
          expires_at: string;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phone_number: string;
          otp_code: string;
          attempts?: number;
          expires_at: string;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          phone_number?: string;
          otp_code?: string;
          attempts?: number;
          expires_at?: string;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'phone_verifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_balance: {
        Args: Record<PropertyKey, never>;
        Returns: {
          total_income_paise: number;
          total_expense_paise: number;
          net_balance_paise: number;
        }[];
      };
      get_monthly_summary: {
        Args: {
          month_start: string;
          month_end: string;
        };
        Returns: {
          total_income_paise: number;
          total_expense_paise: number;
          net_balance_paise: number;
          transaction_count: number;
        }[];
      };
      get_category_spend: {
        Args: {
          month_start: string;
          month_end: string;
        };
        Returns: {
          category_id: string;
          category_name: string;
          category_color: string;
          kind: CategoryKind;
          total_spend_paise: number;
          transaction_count: number;
        }[];
      };
      get_daily_budget_pulse: {
        Args: {
          p_user_id?: string | null;
          p_timezone?: string;
        };
        Returns: {
          monthly_budget_paise: number;
          month_spent_paise: number;
          month_remaining_paise: number;
          spent_today_paise: number;
          daily_safe_allowance_paise: number;
          remaining_today_paise: number;
          days_remaining_in_month: number;
          is_over_budget: boolean;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
