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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      arena_matches: {
        Row: {
          attack_ready: Json
          created_at: string
          eliminated: string[]
          ends_at: string | null
          heartbeats: Json
          id: string
          map_id: string
          mode: string
          rewarded: boolean
          round_ends_at: string | null
          round_no: number
          round_score_a: number
          round_score_b: number
          score_a: number
          score_b: number
          starts_at: string
          status: string
          team_a: string[]
          team_b: string[]
          updated_at: string
          winner: string | null
        }
        Insert: {
          attack_ready?: Json
          created_at?: string
          eliminated?: string[]
          ends_at?: string | null
          heartbeats?: Json
          id?: string
          map_id: string
          mode: string
          rewarded?: boolean
          round_ends_at?: string | null
          round_no?: number
          round_score_a?: number
          round_score_b?: number
          score_a?: number
          score_b?: number
          starts_at: string
          status?: string
          team_a?: string[]
          team_b?: string[]
          updated_at?: string
          winner?: string | null
        }
        Update: {
          attack_ready?: Json
          created_at?: string
          eliminated?: string[]
          ends_at?: string | null
          heartbeats?: Json
          id?: string
          map_id?: string
          mode?: string
          rewarded?: boolean
          round_ends_at?: string | null
          round_no?: number
          round_score_a?: number
          round_score_b?: number
          score_a?: number
          score_b?: number
          starts_at?: string
          status?: string
          team_a?: string[]
          team_b?: string[]
          updated_at?: string
          winner?: string | null
        }
        Relationships: []
      }
      arena_queue: {
        Row: {
          character_id: string
          created_at: string
          id: string
          mode: string
          status: string
          team_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          created_at?: string
          id?: string
          mode: string
          status?: string
          team_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          created_at?: string
          id?: string
          mode?: string
          status?: string
          team_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_queue_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          arena_losses: number
          arena_rating: number
          arena_wins: number
          bank: number
          combat_until: string | null
          created_at: string
          death_drop_enabled: boolean
          deaths: number
          equipment: Json
          exp: number
          frags: number
          gold: number
          guild_id: string | null
          home_city: string
          hp: number
          id: string
          inventory: Json
          kill_window: Json
          last_save: string
          level: number
          magic_level: number
          mana: number
          ml_progress: number
          monsters_killed: number
          mount: string | null
          name: string
          outfit: string
          owned_mounts: string[]
          owned_outfits: string[]
          pos_x: number
          pos_z: number
          quests: Json
          skill_level: number
          skill_progress: number
          skull: string
          skull_until: string | null
          tutorial_step: number
          user_id: string
          vocation: string
          xp_boost_until: string | null
        }
        Insert: {
          arena_losses?: number
          arena_rating?: number
          arena_wins?: number
          bank?: number
          combat_until?: string | null
          created_at?: string
          death_drop_enabled?: boolean
          deaths?: number
          equipment?: Json
          exp?: number
          frags?: number
          gold?: number
          guild_id?: string | null
          home_city?: string
          hp?: number
          id?: string
          inventory?: Json
          kill_window?: Json
          last_save?: string
          level?: number
          magic_level?: number
          mana?: number
          ml_progress?: number
          monsters_killed?: number
          mount?: string | null
          name: string
          outfit?: string
          owned_mounts?: string[]
          owned_outfits?: string[]
          pos_x?: number
          pos_z?: number
          quests?: Json
          skill_level?: number
          skill_progress?: number
          skull?: string
          skull_until?: string | null
          tutorial_step?: number
          user_id: string
          vocation: string
          xp_boost_until?: string | null
        }
        Update: {
          arena_losses?: number
          arena_rating?: number
          arena_wins?: number
          bank?: number
          combat_until?: string | null
          created_at?: string
          death_drop_enabled?: boolean
          deaths?: number
          equipment?: Json
          exp?: number
          frags?: number
          gold?: number
          guild_id?: string | null
          home_city?: string
          hp?: number
          id?: string
          inventory?: Json
          kill_window?: Json
          last_save?: string
          level?: number
          magic_level?: number
          mana?: number
          ml_progress?: number
          monsters_killed?: number
          mount?: string | null
          name?: string
          outfit?: string
          owned_mounts?: string[]
          owned_outfits?: string[]
          pos_x?: number
          pos_z?: number
          quests?: Json
          skill_level?: number
          skill_progress?: number
          skull?: string
          skull_until?: string | null
          tutorial_step?: number
          user_id?: string
          vocation?: string
          xp_boost_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "characters_guild_id_fkey"
            columns: ["guild_id"]
            isOneToOne: false
            referencedRelation: "guilds"
            referencedColumns: ["id"]
          },
        ]
      }
      ground_drops: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          item_id: string
          owner_character: string | null
          pos_x: number
          pos_z: number
          protected_until: string
          qty: number
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          item_id: string
          owner_character?: string | null
          pos_x: number
          pos_z: number
          protected_until?: string
          qty: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          item_id?: string
          owner_character?: string | null
          pos_x?: number
          pos_z?: number
          protected_until?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "ground_drops_owner_character_fkey"
            columns: ["owner_character"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      guilds: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_character: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_character: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_character?: string
          tag?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          character_id: string
          created_at: string
          id: string
          item_id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          character_id: string
          created_at?: string
          id?: string
          item_id: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          character_id?: string
          created_at?: string
          id?: string
          item_id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          from_character: string
          id: string
          item_id: string
          price: number
          qty: number
          status: string
          to_character: string
        }
        Insert: {
          created_at?: string
          from_character: string
          id?: string
          item_id: string
          price?: number
          qty?: number
          status?: string
          to_character: string
        }
        Update: {
          created_at?: string
          from_character?: string
          id?: string
          item_id?: string
          price?: number
          qty?: number
          status?: string
          to_character?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_from_character_fkey"
            columns: ["from_character"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_to_character_fkey"
            columns: ["to_character"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      storm_arena_tick: {
        Args: {
          p_action?: string
          p_character: string
          p_cooldown?: number
          p_damage?: number
          p_mana?: number
          p_target?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
