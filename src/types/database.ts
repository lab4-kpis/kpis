
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_users": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"email": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"email": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"email"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_identifier": string | null,"actor_type": string,"id": number,"metadata": NonNullable<Json>,"occurred_at": string,"resource_id": string | null,"resource_type": string
                  }
                  Insert: {
                    "action": string,"actor_identifier"?: string | null,"actor_type": string,"id"?: never,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"resource_id"?: string | null,"resource_type": string
                  }
                  Update: {
                    "action"?: string,"actor_identifier"?: string | null,"actor_type"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"resource_id"?: string | null,"resource_type"?: string
                  }
                  Relationships: [

                  ]
                },"kpi_catalog": {
                  Row: {
                    "aggregation": string | null,"created_at": string,"deprecated_at": string | null,"description": string,"env": Database["public"]['Enums']["reporting_environment"],"frequency": string,"id": string,"justification": string | null,"kind": Database["public"]['Enums']["kpi_kind"],"name": string | null,"project_id": string,"source": string | null,"unit": string,"updated_at": string
                  }
                  Insert: {
                    "aggregation"?: string | null,"created_at"?: string,"deprecated_at"?: string | null,"description": string,"env"?: Database["public"]['Enums']["reporting_environment"],"frequency"?: string,"id": string,"justification"?: string | null,"kind": Database["public"]['Enums']["kpi_kind"],"name"?: string | null,"project_id": string,"source"?: string | null,"unit": string,"updated_at"?: string
                  }
                  Update: {
                    "aggregation"?: string | null,"created_at"?: string,"deprecated_at"?: string | null,"description"?: string,"env"?: Database["public"]['Enums']["reporting_environment"],"frequency"?: string,"id"?: string,"justification"?: string | null,"kind"?: Database["public"]['Enums']["kpi_kind"],"name"?: string | null,"project_id"?: string,"source"?: string | null,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kpi_catalog_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kpi_catalog_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_compliance"
      referencedColumns: ["project_id"]
    }
                  ]
                },"measurement": {
                  Row: {
                    "date": string,"env": Database["public"]['Enums']["reporting_environment"],"kpi_id": string,"project_id": string,"reported_at": string,"run_id": string,"value": number
                  }
                  Insert: {
                    "date": string,"env": Database["public"]['Enums']["reporting_environment"],"kpi_id": string,"project_id": string,"reported_at"?: string,"run_id": string,"value": number
                  }
                  Update: {
                    "date"?: string,"env"?: Database["public"]['Enums']["reporting_environment"],"kpi_id"?: string,"project_id"?: string,"reported_at"?: string,"run_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "measurement_project_id_env_kpi_id_fkey"
      columns: ["project_id","env","kpi_id"]
isOneToOne: false
      referencedRelation: "kpi_catalog"
      referencedColumns: ["project_id","env","id"]
    }
                  ]
                },"project_api_keys": {
                  Row: {
                    "created_at": string,"created_by": string | null,"env": Database["public"]['Enums']["reporting_environment"],"id": string,"key_hash": string,"key_prefix": string,"last_used_at": string | null,"project_id": string,"revoked_at": string | null,"revoked_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"env": Database["public"]['Enums']["reporting_environment"],"id"?: string,"key_hash": string,"key_prefix": string,"last_used_at"?: string | null,"project_id": string,"revoked_at"?: string | null,"revoked_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"env"?: Database["public"]['Enums']["reporting_environment"],"id"?: string,"key_hash"?: string,"key_prefix"?: string,"last_used_at"?: string | null,"project_id"?: string,"revoked_at"?: string | null,"revoked_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_api_keys_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_api_keys_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_compliance"
      referencedColumns: ["project_id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "active": boolean,"contact_name": string | null,"contact_phone": string | null,"created_at": string,"deactivated_at": string | null,"id": string,"name": string,"project_key": string,"team_number": number,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"contact_name"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"id"?: string,"name": string,"project_key": string,"team_number": number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"contact_name"?: string | null,"contact_phone"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"id"?: string,"name"?: string,"project_key"?: string,"team_number"?: number,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"reporting_settings": {
                  Row: {
                    "ends_on": string | null,"singleton": boolean,"starts_on": string | null,"timezone": string,"updated_at": string,"updated_by": string | null,"weekdays": (number)[]
                  }
                  Insert: {
                    "ends_on"?: string | null,"singleton"?: boolean,"starts_on"?: string | null,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null,"weekdays"?: (number)[]
                  }
                  Update: {
                    "ends_on"?: string | null,"singleton"?: boolean,"starts_on"?: string | null,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null,"weekdays"?: (number)[]
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            "v_compliance": {
                  Row: {
                    "business_kpis": number | null,"expected_kpis": number | null,"health_kpis": number | null,"project_id": string | null,"project_key": string | null,"project_name": string | null,"report_date": string | null,"score": number | null,"status": string | null,"team_number": number | null,"technical_kpis": number | null,"valid_kpis": number | null
                  }
                  Relationships: [

                  ]
                },"v_public_compliance": {
                  Row: {
                    "business_kpis": number | null,"expected_kpis": number | null,"health_kpis": number | null,"project_name": string | null,"report_date": string | null,"score": number | null,"status": string | null,"team_number": number | null,"technical_kpis": number | null,"valid_kpis": number | null
                  }
                  Relationships: [

                  ]
                },"v_measurements_enriched": {
                  Row: {
                    "date": string | null,"description": string | null,"env": Database["public"]['Enums']["reporting_environment"] | null,"kind": Database["public"]['Enums']["kpi_kind"] | null,"kpi_id": string | null,"kpi_name": string | null,"project_id": string | null,"project_key": string | null,"project_name": string | null,"received_on": string | null,"reported_at": string | null,"run_id": string | null,"team_number": number | null,"unit": string | null,"value": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "measurement_project_id_env_kpi_id_fkey"
      columns: ["project_id","env","kpi_id"]
isOneToOne: false
      referencedRelation: "kpi_catalog"
      referencedColumns: ["project_id","env","id"]
    }
                  ]
                }
          }
          Functions: {
            "current_project":
{ Args: Record<PropertyKey, never>; Returns: {
              "env": Database["public"]['Enums']["reporting_environment"],"name": string,"project_key": string,"team_number": number
            }[]
                           },
"hook_restrict_admin_signup":
{ Args: { "event": Json }; Returns: Json
                           },
"is_current_user_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"issue_project_key":
{ Args: { "p_env": Database["public"]['Enums']["reporting_environment"],"p_project_id": string }; Returns: {
              "api_key": string,"key_prefix": string
            }[]
                           },
"mcp_authorization_targets_mcp":
{ Args: { "p_authorization_id": string }; Returns: boolean
                           },
"revoke_project_key":
{ Args: { "p_key_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "kpi_kind": "business"|"technical"|"health","reporting_environment": "dev"|"qa"|"prod"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "kpi_kind": ["business", "technical", "health"],"reporting_environment": ["dev", "qa", "prod"]
          }
        }
} as const
