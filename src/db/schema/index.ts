/**
 * Typed table definitions (the "ORM" layer).
 * When you add a table or column in a new migration file, mirror it here so
 * the rest of the app gets autocomplete and type checking.
 */
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type GiftSearchRow = {
  id: string;
  created_at: string;
  session_id: string;
  recipient_relationship: string | null;
  recipient_age_range: string | null;
  recipient_gender: string | null;
  occasion: string | null;
  interests: string[] | null;
  personality_traits: string[] | null;
  budget_range: string | null;
  additional_notes: string | null;
  photo_url: string | null;
  recommendations: Json | null;
};

export type EmailCaptureRow = {
  id: string;
  created_at: string;
  email: string;
  source: string | null;
  search_id: string | null;
};

export type ProductRow = {
  id: string;
  external_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  price: number;
  currency: string;
  tags: string[];
  age_groups: string[];
  gift_type: string;
  attributes: Json;
  image_url: string | null;
  product_url: string | null;
  buy_url: string;
  provider: string;
  popularity: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type RecommendationRow = {
  id: string;
  created_at: string;
  recommendation_id: string;
  search_id: string | null;
  session_id: string | null;
  segment: string;
  product_id: string;
  slot: string;
  rank: number;
  score: number;
  reason: string | null;
  features: Json;
  model_version: string;
  strategy: string;
};

export type InteractionEventRow = {
  id: string;
  created_at: string;
  event_type: string;
  product_id: string | null;
  recommendation_id: string | null;
  search_id: string | null;
  session_id: string | null;
  rank: number | null;
};

export type ProductSegmentStatsRow = {
  product_id: string;
  segment: string;
  impressions: number;
  clicks: number;
  model_version: string;
};

export type ModelVersionRow = {
  version: string;
  trained_at: string;
  status: string;
  feature_version: string;
  records_used: number;
  dataset_from: string | null;
  dataset_to: string | null;
  metrics: Json;
};

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      gift_searches: Table<GiftSearchRow, "session_id">;
      email_captures: Table<EmailCaptureRow, "email">;
      products: Table<ProductRow, "id" | "title" | "price" | "buy_url">;
      recommendations: Table<
        RecommendationRow,
        "recommendation_id" | "segment" | "product_id" | "slot" | "rank" | "score" | "model_version" | "strategy"
      >;
      interaction_events: Table<InteractionEventRow, "event_type">;
      product_segment_stats: Table<
        ProductSegmentStatsRow,
        "product_id" | "segment" | "impressions" | "clicks" | "model_version"
      >;
      model_versions: Table<ModelVersionRow, "version">;
    };
    Views: Record<string, never>;
    Functions: {
      engine_train: {
        Args: { min_interval_minutes?: number };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
