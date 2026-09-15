-- ============================================================================
-- OFFER GRAPH SCHEMA — validation-ready v1
-- Working brand: SPORLAG (NOT LOCKED — no brand strings in schema/domain)
-- Portable SQL subset: SQLite now, PostgreSQL-compatible design (ISO TEXT
-- timestamps, INTEGER 0/1 booleans, TEXT enums, language-neutral enums).
-- Conceptual separation (§25 BUILD_SPEC):
--   RAW SOURCE STORE   -> messages (private raw/normalized)
--   EVIDENCE STORE     -> extractions, extraction_fields, human_corrections
--   OFFER GRAPH        -> companies, sources, campaigns, offers, versions
--   PUBLIC PROJECTION  -> published versions + approved evidence + aggregates
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------- RAW SOURCE STORE (PRIVATE BY DEFAULT) ----------

CREATE TABLE IF NOT EXISTS companies (
  id            TEXT PRIMARY KEY,            -- company_001
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  market        TEXT NOT NULL DEFAULT 'DK',  -- language-neutral
  category      TEXT,                        -- telecom, streaming, energy...
  status        TEXT NOT NULL DEFAULT 'active', -- active | inactive
  website       TEXT,                        -- official site, used to fetch logo on add
  logo_path     TEXT,                        -- public path e.g. /logos/telmore.png
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter_sources (
  id                 TEXT PRIMARY KEY,       -- source_001
  company_id         TEXT NOT NULL REFERENCES companies(id),
  name               TEXT NOT NULL,
  alias_email        TEXT NOT NULL UNIQUE,   -- platform-controlled alias
  market             TEXT NOT NULL DEFAULT 'DK',
  language           TEXT NOT NULL DEFAULT 'da',
  subscription_type  TEXT NOT NULL DEFAULT 'direct_public_signup',
  status             TEXT NOT NULL DEFAULT 'active', -- active | paused | unverified
  source_confidence  TEXT NOT NULL DEFAULT 'direct_subscription',
  created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id                     TEXT PRIMARY KEY,   -- message_001
  source_id              TEXT NOT NULL REFERENCES newsletter_sources(id),
  received_at            TEXT NOT NULL,
  subject_private        TEXT NOT NULL,      -- PRIVATE: never exposed via consumer APIs
  body_raw_private       TEXT NOT NULL,      -- PRIVATE: raw HTML as received
  body_normalized_private TEXT NOT NULL,     -- PRIVATE: sanitized plain text (evidence offsets refer to this)
  links_json             TEXT NOT NULL DEFAULT '[]', -- safe captured links [{href,text}]
  headers_min_json       TEXT NOT NULL DEFAULT '{}', -- minimized headers only
  state                  TEXT NOT NULL DEFAULT 'RECEIVED',
    -- RECEIVED | PROCESSING | EXTRACTED | NEEDS_REVIEW | VERIFIED | PUBLISHED
    -- special: NO_OFFER | DUPLICATE | LOW_CONFIDENCE | POSSIBLE_UPDATE | FAILED | ARCHIVED
  content_fingerprint    TEXT NOT NULL,      -- sha256 of normalized body (duplicate protection)
  created_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_source ON messages(source_id);
CREATE INDEX IF NOT EXISTS idx_messages_state ON messages(state);
CREATE INDEX IF NOT EXISTS idx_messages_fingerprint ON messages(content_fingerprint);

-- ---------- EVIDENCE STORE ----------

-- AIObservation: one extraction = one candidate offer detected in a message.
-- Multiple offers per message supported (offer_index).
CREATE TABLE IF NOT EXISTS extractions (
  id                 TEXT PRIMARY KEY,       -- extraction_001
  message_id         TEXT NOT NULL REFERENCES messages(id),
  offer_index        INTEGER NOT NULL DEFAULT 0,
  extractor_version  TEXT NOT NULL,          -- extractor-0.1
  is_offer           INTEGER NOT NULL DEFAULT 1,
  offer_type         TEXT,                   -- subscription_discount | one_time_purchase | ...
  headline           TEXT,
  claim_original     TEXT,                   -- original source language preserved
  source_language    TEXT NOT NULL DEFAULT 'da',
  status             TEXT NOT NULL DEFAULT 'candidate',
    -- candidate | confirmed | edited | rejected | not_an_offer | merged | split
  created_at         TEXT NOT NULL,
  UNIQUE (message_id, offer_index)
);
CREATE INDEX IF NOT EXISTS idx_extractions_message ON extractions(message_id);

-- Provenance envelope (§6): every derived field carries evidence + confidence.
CREATE TABLE IF NOT EXISTS extraction_fields (
  id                  TEXT PRIMARY KEY,      -- efield_001
  extraction_id       TEXT NOT NULL REFERENCES extractions(id),
  field               TEXT NOT NULL,         -- advertised_price, normal_price, ...
  value_json          TEXT NOT NULL,         -- structured value {amount,currency,period} | text
  evidence_span       TEXT NOT NULL,         -- exact source text
  locator_start       INTEGER NOT NULL,      -- offsets into body_normalized_private
  locator_end         INTEGER NOT NULL,
  confidence          REAL NOT NULL,
  extractor_version   TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | edited | unknown
  verified_by         TEXT REFERENCES users(id),
  verified_at         TEXT,
  UNIQUE (extraction_id, field)
);
CREATE INDEX IF NOT EXISTS idx_efields_extraction ON extraction_fields(extraction_id);

-- Human corrections = Verified Offer Dataset (§10)
CREATE TABLE IF NOT EXISTS human_corrections (
  id                  TEXT PRIMARY KEY,
  extraction_field_id TEXT NOT NULL REFERENCES extraction_fields(id),
  ai_prediction_json  TEXT NOT NULL,         -- frozen AI value + span + confidence
  human_action        TEXT NOT NULL,         -- confirm | edit | unknown
  human_value_json    TEXT,                  -- null for confirm/unknown
  evidence_span       TEXT NOT NULL,
  extractor_version   TEXT NOT NULL,
  reviewer_id         TEXT NOT NULL REFERENCES users(id),
  corrected_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_corrections_field ON human_corrections(extraction_field_id);

-- ---------- OFFER GRAPH ----------

CREATE TABLE IF NOT EXISTS campaigns (
  id            TEXT PRIMARY KEY,            -- campaign_001
  company_id    TEXT NOT NULL REFERENCES companies(id),
  working_name  TEXT NOT NULL,
  first_seen    TEXT NOT NULL,
  last_seen     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offers (
  id                 TEXT PRIMARY KEY,       -- offer_001
  company_id         TEXT NOT NULL REFERENCES companies(id),
  campaign_id        TEXT REFERENCES campaigns(id),
  offer_type         TEXT NOT NULL,
  canonical_identity TEXT NOT NULL,          -- normalized identity string for matching
  first_seen         TEXT NOT NULL,
  last_seen          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offers_company ON offers(company_id);
CREATE INDEX IF NOT EXISTS idx_offers_campaign ON offers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_sources_company ON newsletter_sources(company_id);

CREATE TABLE IF NOT EXISTS offer_versions (
  id                    TEXT PRIMARY KEY,    -- offer_version_004
  offer_id              TEXT NOT NULL REFERENCES offers(id),
  version               INTEGER NOT NULL,
  message_id            TEXT NOT NULL REFERENCES messages(id),
  claim_original        TEXT NOT NULL,       -- original language preserved
  source_language       TEXT NOT NULL DEFAULT 'da',
  observed_at           TEXT NOT NULL,
  fields_json           TEXT NOT NULL,       -- snapshot of verified structured fields
  verification_status   TEXT NOT NULL DEFAULT 'pending', -- pending | verified | rejected
  publication_status    TEXT NOT NULL DEFAULT 'unpublished', -- unpublished | published
  predecessor_version_id TEXT REFERENCES offer_versions(id),
  changed_fields_json   TEXT NOT NULL DEFAULT '[]',
  published_at          TEXT,
  published_by          TEXT REFERENCES users(id),
  verified_by           TEXT REFERENCES users(id),
  verified_at           TEXT,
  created_at            TEXT NOT NULL,
  UNIQUE (offer_id, version)
);
CREATE INDEX IF NOT EXISTS idx_versions_offer ON offer_versions(offer_id);
CREATE INDEX IF NOT EXISTS idx_versions_pub ON offer_versions(publication_status);
CREATE INDEX IF NOT EXISTS idx_versions_pub_offer ON offer_versions(publication_status, offer_id, version);
CREATE INDEX IF NOT EXISTS idx_versions_message ON offer_versions(message_id);
CREATE INDEX IF NOT EXISTS idx_versions_observed ON offer_versions(publication_status, observed_at);

-- Approved evidence for public projection (excerpts only — raw stays private)
CREATE TABLE IF NOT EXISTS evidence (
  id                TEXT PRIMARY KEY,        -- evidence_001
  offer_version_id  TEXT NOT NULL REFERENCES offer_versions(id),
  field             TEXT NOT NULL,
  evidence_span     TEXT NOT NULL,           -- approved excerpt
  source_message_id TEXT NOT NULL REFERENCES messages(id),
  evidence_ref      TEXT NOT NULL,           -- public reference label e.g. EVIDENCE 03
  approved_for_public INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_version ON evidence(offer_version_id);

-- Change detection (§12): first-class object
CREATE TABLE IF NOT EXISTS version_changes (
  id                     TEXT PRIMARY KEY,
  predecessor_version_id TEXT NOT NULL REFERENCES offer_versions(id),
  successor_version_id   TEXT NOT NULL REFERENCES offer_versions(id),
  field                  TEXT NOT NULL,
  old_value_json         TEXT NOT NULL,
  new_value_json         TEXT NOT NULL,
  changed_at             TEXT NOT NULL,
  evidence_ref           TEXT
);
CREATE INDEX IF NOT EXISTS idx_vchanges_successor ON version_changes(successor_version_id);
CREATE INDEX IF NOT EXISTS idx_vchanges_changed ON version_changes(changed_at);

-- Matching audit (§11): layered candidates + reviewer override
CREATE TABLE IF NOT EXISTS match_candidates (
  id                 TEXT PRIMARY KEY,
  extraction_id      TEXT NOT NULL REFERENCES extractions(id),
  candidate_offer_id TEXT NOT NULL REFERENCES offers(id),
  confidence         REAL NOT NULL,
  reason_codes_json  TEXT NOT NULL DEFAULT '[]',
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  reviewer_decision  TEXT,                   -- accept | reject (override) | null=pending
  reviewer_id        TEXT REFERENCES users(id),
  decided_at         TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_match_extraction ON match_candidates(extraction_id);

-- ---------- COMMUNITY ----------

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,            -- user_001
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,               -- scrypt
  role          TEXT NOT NULL DEFAULT 'consumer',
    -- consumer | ambassador | editor | admin | b2b_user (language-neutral)
  locale        TEXT NOT NULL DEFAULT 'da-DK',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,               -- random hex
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS contributor_profiles (
  user_id             TEXT PRIMARY KEY REFERENCES users(id),
  contribution_points INTEGER NOT NULL DEFAULT 0,  -- activity
  reputation          INTEGER NOT NULL DEFAULT 50, -- reliability (0-100)
  impact_count        INTEGER NOT NULL DEFAULT 0   -- downstream usefulness
);

CREATE TABLE IF NOT EXISTS user_newsletter_selections (
  user_id      TEXT NOT NULL REFERENCES users(id),
  source_id    TEXT NOT NULL REFERENCES newsletter_sources(id),
  selected_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, source_id)
);

CREATE TABLE IF NOT EXISTS company_suggestions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  company_name  TEXT NOT NULL,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | duplicate
  matched_company_id TEXT REFERENCES companies(id),
  moderated_by  TEXT REFERENCES users(id),
  moderated_at  TEXT,
  created_at    TEXT NOT NULL
);

-- Personal review queue (§9/§16): concrete campaigns the user receives
CREATE TABLE IF NOT EXISTS review_tasks (
  id               TEXT PRIMARY KEY,         -- task_001
  user_id          TEXT NOT NULL REFERENCES users(id),
  offer_version_id TEXT NOT NULL REFERENCES offer_versions(id),
  status           TEXT NOT NULL DEFAULT 'open', -- open | completed | dismissed
  created_at       TEXT NOT NULL,
  completed_at     TEXT,
  UNIQUE (user_id, offer_version_id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON review_tasks(user_id, status);

-- Structured factual observations (§16). No star ratings. Language-neutral enums.
CREATE TABLE IF NOT EXISTS community_observations (
  id               TEXT PRIMARY KEY,
  offer_version_id TEXT NOT NULL REFERENCES offer_versions(id),
  user_id          TEXT NOT NULL REFERENCES users(id),
  question_key     TEXT NOT NULL,
    -- price_clarity | period_clarity | post_intro_clarity | conditions_visibility | worked_as_described
  response         TEXT NOT NULL,
    -- clear | partial | unclear | unknown  (outcome question: confirmed | not_confirmed | unknown)
  created_at       TEXT NOT NULL,
  UNIQUE (offer_version_id, user_id, question_key)
);
CREATE INDEX IF NOT EXISTS idx_obs_version ON community_observations(offer_version_id);

-- ---------- RECOGNITION (§19) ----------

CREATE TABLE IF NOT EXISTS recognitions (
  id               TEXT PRIMARY KEY,
  offer_version_id TEXT NOT NULL REFERENCES offer_versions(id),
  status           TEXT NOT NULL,            -- clearly_documented | insufficient_documentation
  method_version   TEXT NOT NULL,            -- recognition-method-0.1
  dimensions_json  TEXT NOT NULL,            -- [{key,assessment,rationale}]
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  sample_size      INTEGER NOT NULL DEFAULT 0,
  suggested_by     TEXT NOT NULL DEFAULT 'engine',
  verified_by      TEXT REFERENCES users(id), -- human verification required
  verified_at      TEXT,
  decided_at       TEXT NOT NULL,
  UNIQUE (offer_version_id)
);

-- ---------- MARKET PULSE (§20 editorial) ----------

CREATE TABLE IF NOT EXISTS pulse_issues (
  id             TEXT PRIMARY KEY,
  period         TEXT NOT NULL UNIQUE,       -- 2026-09
  title          TEXT NOT NULL,
  standfirst     TEXT NOT NULL,
  blocks_json    TEXT NOT NULL,              -- editorial blocks [{type,...}]
  methodology    TEXT NOT NULL,
  sample_size    INTEGER NOT NULL,
  published_at   TEXT
);

-- ---------- OPERATIONS ----------

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES users(id),     -- null = system
  action      TEXT NOT NULL,                 -- e.g. version.published, extraction.corrected
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- Rebrandability (§24/§26): brand config lives in data, never in schema names
CREATE TABLE IF NOT EXISTS brand_config (
  key        TEXT PRIMARY KEY,               -- brand.name, brand.tagline, ...
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Lightweight rate limiting for community contributions (§27)
CREATE TABLE IF NOT EXISTS rate_buckets (
  bucket_key  TEXT PRIMARY KEY,              -- ip/user + window
  count       INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);
