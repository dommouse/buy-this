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
  occasion: string[];
  price_tier: string | null;
  relationship: string[];
  parent_type: string[];
  wear_use_do: string | null;
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

export type AdminUserRow = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  password_hash: string;
  role: "super" | "admin";
  is_active: boolean;
  last_login_at: string | null;
};

export type AdminSessionRow = {
  id: string;
  created_at: string;
  admin_user_id: string;
  token_hash: string;
  expires_at: string;
};

export type PortalUserRow = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  email_verified_at: string | null;
};

export type PortalSessionRow = {
  id: string;
  created_at: string;
  portal_user_id: string;
  token_hash: string;
  expires_at: string;
};

export type NewsletterSubscriberRow = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  source: string;
  status: "subscribed" | "unsubscribed";
  unsubscribe_token: string;
  meta: Json;
};

export type NewsletterCampaignRow = {
  id: string;
  created_at: string;
  updated_at: string;
  subject: string;
  html_body: string;
  status: "draft" | "sending" | "sent" | "failed";
  sent_at: string | null;
  recipient_count: number;
  created_by: string | null;
};

export type NewsletterSettingsRow = {
  id: number;
  enabled: boolean;
  from_name: string;
  footer_html: string;
  double_opt_in: boolean;
  updated_at: string;
};

export type GiftCatalogRow = {
  id: string;
  created_at: string;
  updated_at: string;
  sku: string;
  title: string;
  description: string;
  retailer: string;
  price: number | null;
  price_tier: string | null;
  occasion: string;
  relationship: string;
  gender: string;
  age_start: number | null;
  age_end: number | null;
  tags: string[];
  slot: string;
  gift_note: string;
  available_from: string | null;
  available_to: string | null;
  category: string;
  verification_note: string;
  status: string;
  buy_url: string;
  asin: string | null;
  external_ref: string;
  is_dead: boolean;
  last_synced_at: string | null;
};

export type BlogRow = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  cover_url: string | null;
  author_admin_id: string | null;
  status: "draft" | "published";
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  view_count: number;
};

export type AppSettingRow = {
  key: string;
  value: Json;
  updated_at: string;
};

export type AdminAuditLogRow = {
  id: string;
  created_at: string;
  admin_user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: Json;
};

export type HomeBannerRow = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  cta_label: string;
  sort_order: number;
  is_active: boolean;
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
      admin_users: Table<AdminUserRow, "name" | "email" | "password_hash">;
      admin_sessions: Table<AdminSessionRow, "admin_user_id" | "token_hash" | "expires_at">;
      portal_users: Table<PortalUserRow, "name" | "email" | "password_hash">;
      portal_sessions: Table<PortalSessionRow, "portal_user_id" | "token_hash" | "expires_at">;
      newsletter_subscribers: Table<NewsletterSubscriberRow, "email">;
      newsletter_campaigns: Table<NewsletterCampaignRow, "subject">;
      newsletter_settings: Table<NewsletterSettingsRow, never>;
      gift_catalog: Table<GiftCatalogRow, "sku" | "title">;
      blogs: Table<BlogRow, "title" | "slug">;
      home_banners: Table<HomeBannerRow, "image_url">;
      app_settings: Table<AppSettingRow, "key" | "value">;
      admin_audit_log: Table<AdminAuditLogRow, "action">;
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
