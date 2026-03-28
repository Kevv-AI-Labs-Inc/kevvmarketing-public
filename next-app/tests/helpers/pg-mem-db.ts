import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/lib/db/schema";

const bootstrapSql = `
  create type agent_tier as enum ('free', 'pro', 'premium');
  create type agent_profile_status as enum ('draft', 'active', 'suspended');
  create type contact_status as enum ('new', 'contacted', 'qualified', 'converted', 'lost', 'archived');
  create type lead_score as enum ('hot', 'warm', 'cold');

  create table agent_profiles (
    id serial primary key,
    user_id integer,
    slug varchar(64) not null,
    email varchar(320) not null,
    name varchar(255) not null,
    phone varchar(32),
    title varchar(128) default 'Licensed Real Estate Agent',
    brokerage varchar(255),
    license_state varchar(16),
    office_address varchar(255),
    booking_url text,
    photo_url text,
    logo_url text,
    hero_image_url text,
    bio text,
    service_areas jsonb not null default '[]'::jsonb,
    specialties jsonb not null default '[]'::jsonb,
    languages jsonb not null default '[\"English\"]'::jsonb,
    awards jsonb not null default '[]'::jsonb,
    testimonials jsonb not null default '[]'::jsonb,
    transactions jsonb not null default '[]'::jsonb,
    neighborhood_knowledge jsonb not null default '{}'::jsonb,
    social_links jsonb not null default '{}'::jsonb,
    visibility_settings jsonb not null default '{\"showPhone\":true,\"showEmail\":true,\"showTransactions\":true,\"showAwards\":true,\"showTestimonials\":true,\"showAddress\":true}'::jsonb,
    years_experience integer default 0,
    template_id varchar(32) default 'classic',
    color_scheme varchar(32) default 'gold',
    status agent_profile_status not null default 'active',
    tier agent_tier not null default 'free',
    stripe_customer_id varchar(128),
    stripe_subscription_id varchar(128),
    subscription_status varchar(32),
    current_period_end timestamp,
    last_published_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
  );

  create table contacts (
    id serial primary key,
    agent_id integer,
    agent_profile_id integer,
    conversation_session_id integer,
    valuation_run_id integer,
    external_id varchar(255),
    source varchar(64) not null default 'manual',
    source_ref varchar(255),
    status contact_status not null default 'new',
    score lead_score not null default 'cold',
    intent varchar(64),
    summary text,
    name varchar(255),
    first_name varchar(100),
    last_name varchar(100),
    email varchar(320),
    phone varchar(64),
    wechat_id varchar(100),
    preferred_language varchar(10) default 'en',
    budget_min varchar(20),
    budget_max varchar(20),
    area varchar(255),
    timeline varchar(255),
    notes text,
    tags jsonb not null default '[]'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    address_line_1 varchar(255),
    address_line_2 varchar(255),
    city varchar(120),
    state varchar(32),
    postal_code varchar(20),
    country varchar(2) default 'US',
    address_verified boolean not null default false,
    address_verified_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
  );

  create table client_events (
    id serial primary key,
    contact_id integer,
    agent_id integer,
    event_type varchar(50) not null,
    event_data jsonb default '{}'::jsonb,
    source_type varchar(30),
    source_id varchar(255),
    session_token varchar(255),
    ip_address varchar(45),
    user_agent text,
    created_at timestamp not null default now()
  );

  create table valuation_runs (
    id serial primary key,
    agent_id integer,
    agent_profile_id integer,
    contact_id integer,
    source varchar(64) not null default 'home_value',
    status varchar(20) not null default 'completed',
    locale varchar(10) default 'en',
    address text not null,
    result jsonb,
    model_used varchar(100),
    provider varchar(100),
    summary text,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
  );

  create table postcard_templates (
    id serial primary key,
    agent_id integer,
    name varchar(255) not null,
    category varchar(64) not null,
    is_system boolean not null default false,
    size_code varchar(16) not null default '4x6',
    thumbnail_url text,
    note text,
    front_editor_state jsonb,
    back_editor_state jsonb,
    front_render_definition jsonb,
    back_render_definition jsonb,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
  );

  create table drip_campaigns (
    id serial primary key,
    agent_id integer,
    name varchar(255) not null,
    trigger_type varchar(30) not null,
    trigger_config jsonb,
    status varchar(20) not null default 'draft',
    total_enrollments integer not null default 0,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
  );

  create table drip_enrollments (
    id serial primary key,
    campaign_id integer not null,
    contact_id integer not null,
    current_step integer not null default 0,
    status varchar(20) not null default 'active',
    next_fire_at timestamp,
    last_fired_at timestamp,
    metadata jsonb,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
  );

  create table agent_insights (
    id serial primary key,
    agent_id integer,
    contact_id integer,
    insight_type varchar(30) not null,
    title varchar(255) not null,
    description text,
    priority varchar(10) not null default 'medium',
    suggested_action varchar(30),
    action_data jsonb,
    is_read boolean not null default false,
    is_actioned boolean not null default false,
    expires_at timestamp,
    created_at timestamp not null default now()
  );

  create table engagement_scores (
    id serial primary key,
    contact_id integer not null,
    agent_id integer,
    score integer not null default 0,
    factors jsonb default '{}'::jsonb,
    score_model varchar(30) not null default 'v1',
    updated_at timestamp not null default now(),
    created_at timestamp not null default now()
  );
`;

export async function createPgMemDb() {
  const client = new PGlite();
  await client.exec(bootstrapSql);
  const db = drizzle(client, { schema });

  return {
    db,
    client,
    async close() {
      await client.close();
    },
  };
}
