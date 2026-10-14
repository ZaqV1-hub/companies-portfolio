CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  logo_url TEXT NULL,
  cover_url TEXT NULL,
  description JSON NULL,
  website VARCHAR(2048) NULL,
  city VARCHAR(200) NULL,
  state VARCHAR(2) NULL,
  size VARCHAR(32) NULL,
  segments JSON NULL,
  partnership_types JSON NULL,
  leadership JSON NULL,
  gallery JSON NULL,
  focal_point JSON NULL,
  status VARCHAR(32) NULL,
  public_state VARCHAR(32) NOT NULL DEFAULT 'hidden',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  last_approved_at DATE NULL,
  last_updated_at DATE NULL,
  invited_at DATE NULL,
  created_at DATETIME NULL,
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  seed_note TEXT NULL,
  CONSTRAINT ck_org_public_state CHECK (public_state IN ('published','provisional','hidden')),
  INDEX idx_org_public_featured (public_state, is_featured),
  INDEX idx_org_size (size),
  INDEX idx_org_segments ((CAST(segments AS CHAR(64) ARRAY))),
  INDEX idx_org_partnership_types ((CAST(partnership_types AS CHAR(64) ARRAY)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  organization_id VARCHAR(80) NOT NULL,
  profile_type VARCHAR(1) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  summary JSON NULL,
  fields JSON NOT NULL,
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  regulatory_phase VARCHAR(32) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(fields, '$.regulatory_phase'))) STORED,
  trl_value TINYINT UNSIGNED GENERATED ALWAYS AS (CAST(JSON_UNQUOTE(JSON_EXTRACT(fields, '$.trl')) AS UNSIGNED)) STORED,
  maturity VARCHAR(32) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(fields, '$.maturity'))) STORED,
  CONSTRAINT fk_projects_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT ck_project_profile_type CHECK (profile_type IN ('A','B','C','D','E','F')),
  INDEX idx_projects_org_order (organization_id, sort_order),
  INDEX idx_projects_profile (profile_type),
  INDEX idx_projects_phase (regulatory_phase),
  INDEX idx_projects_trl (trl_value),
  INDEX idx_projects_maturity (maturity),
  INDEX idx_projects_target_markets ((CAST(fields->'$.target_markets' AS CHAR(40) ARRAY))),
  INDEX idx_projects_markets_served ((CAST(fields->'$.markets_served' AS CHAR(40) ARRAY))),
  INDEX idx_projects_export_markets ((CAST(fields->'$.export_markets' AS CHAR(40) ARRAY)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  role VARCHAR(32) NOT NULL,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(320) NOT NULL,
  email_normalized VARCHAR(320) GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED,
  password_hash VARCHAR(100) NOT NULL,
  organization_id VARCHAR(80) NULL,
  contact_id VARCHAR(100) NULL,
  email_verified_at DATETIME NULL,
  verification_token_hash CHAR(64) NULL,
  lang VARCHAR(2) NOT NULL DEFAULT 'en',
  investor_profile JSON NULL,
  terms_accepted_at DATETIME NULL,
  privacy_accepted_at DATETIME NULL,
  created_at DATETIME NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_users_role CHECK (role IN ('investor','company_user','team')),
  CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
  UNIQUE KEY uq_users_email_normalized (email_normalized),
  INDEX idx_users_role (role),
  INDEX idx_users_org_role (organization_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profile_versions (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  organization_id VARCHAR(80) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL,
  content JSON NOT NULL,
  reviewed_steps JSON NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  submitted_at DATETIME NULL,
  submitted_by VARCHAR(100) NULL,
  review_comment TEXT NULL,
  reviewed_at DATETIME NULL,
  reviewed_by VARCHAR(100) NULL,
  approved_at DATETIME NULL,
  CONSTRAINT fk_profile_versions_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_profile_versions_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_profile_versions_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_profile_version_kind CHECK (kind IN ('published','draft')),
  CONSTRAINT ck_profile_version_status CHECK (status IN ('filling','in_review','returned','published')),
  INDEX idx_profile_versions_queue (kind, status, submitted_at),
  INDEX idx_profile_versions_org_status (organization_id, kind, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS form_imports (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  organization_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(100) NULL,
  field VARCHAR(150) NOT NULL,
  mode VARCHAR(16) NOT NULL,
  previous_answer TEXT NULL,
  source_column VARCHAR(16) NULL,
  CONSTRAINT fk_form_imports_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_form_imports_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT ck_form_import_mode CHECK (mode IN ('prefilled','reference')),
  INDEX idx_form_imports_org (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institutions (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  name VARCHAR(300) NOT NULL,
  investor_type VARCHAR(64) NULL,
  niche VARCHAR(64) NULL,
  ticket_min_musd DECIMAL(14,2) NULL,
  ticket_max_musd DECIMAL(14,2) NULL,
  interest_type VARCHAR(64) NULL,
  sectors JSON NULL,
  description_original TEXT NULL,
  description_pt TEXT NULL,
  website VARCHAR(2048) NULL,
  hq_country VARCHAR(2) NULL,
  hq_city VARCHAR(200) NULL,
  created_at DATETIME NULL,
  normalized_name VARCHAR(300) GENERATED ALWAYS AS (LOWER(TRIM(name))) STORED,
  UNIQUE KEY uq_institutions_normalized_name (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  institution_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(320) NOT NULL,
  email_normalized VARCHAR(320) GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED,
  country VARCHAR(2) NOT NULL,
  city VARCHAR(200) NOT NULL,
  role VARCHAR(200) NULL,
  linkedin VARCHAR(2048) NULL,
  phone VARCHAR(64) NULL,
  created_at DATETIME NULL,
  CONSTRAINT fk_contacts_institution FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_contacts_email_normalized (email_normalized),
  INDEX idx_contacts_institution (institution_id),
  INDEX idx_contacts_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS relationships (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  contact_id VARCHAR(100) NOT NULL,
  organization_id VARCHAR(80) NOT NULL,
  owner_user_id VARCHAR(100) NULL,
  origin VARCHAR(200) NULL,
  status VARCHAR(32) NULL,
  deal_expectation JSON NULL,
  classification VARCHAR(32) NOT NULL DEFAULT 'lead',
  classification_state VARCHAR(32) NOT NULL DEFAULT 'validated',
  suggested JSON NULL,
  npia JSON NULL,
  contact_request_at DATE NULL,
  validated_at DATETIME NULL,
  validated_by VARCHAR(100) NULL,
  apex_control JSON NULL,
  created_at DATETIME NULL,
  CONSTRAINT fk_relationship_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  CONSTRAINT fk_relationship_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_relationship_validator FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_relationship_classification CHECK (classification IN ('lead','nia','npia','br','incomplete')),
  UNIQUE KEY uq_contact_organization (contact_id, organization_id),
  INDEX idx_relationship_org_class_status (organization_id, classification, status),
  INDEX idx_relationship_org_created (organization_id, created_at),
  INDEX idx_relationship_contact (contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS interactions (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  relationship_id VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  type VARCHAR(64) NULL,
  apex_product VARCHAR(64) NULL,
  event VARCHAR(200) NULL,
  project_id VARCHAR(100) NULL,
  auto BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(100) NULL,
  created_at DATETIME NULL,
  CONSTRAINT fk_interactions_relationship FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
  CONSTRAINT fk_interactions_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_interactions_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_interactions_relationship_date (relationship_id, date),
  INDEX idx_interactions_date_type (date, type),
  INDEX idx_interactions_event (event)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consents (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  terms_version VARCHAR(64) NOT NULL,
  privacy_version VARCHAR(64) NOT NULL,
  accepted_at DATETIME NOT NULL,
  CONSTRAINT fk_consents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_consents_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  launch_date DATE NOT NULL,
  deadlines JSON NOT NULL,
  goals JSON NOT NULL,
  origins JSON NOT NULL,
  apex_strategic_categories JSON NOT NULL,
  holidays JSON NOT NULL,
  updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_outbox (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  template VARCHAR(100) NOT NULL,
  `to` VARCHAR(320) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME NULL,
  sent BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX idx_email_outbox_sent_created (sent, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT NULL,
  INDEX idx_sessions_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
