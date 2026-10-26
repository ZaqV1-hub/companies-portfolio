ALTER TABLE email_outbox ADD COLUMN ready_to_send BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE email_outbox ADD COLUMN attempts INT NOT NULL DEFAULT 0;
ALTER TABLE email_outbox ADD COLUMN last_error TEXT NULL;

CREATE TABLE IF NOT EXISTS company_invitations (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  organization_id VARCHAR(80) NOT NULL,
  email VARCHAR(320) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_company_invitation_token (token_hash),
  INDEX idx_company_invitation_org (organization_id, created_at),
  CONSTRAINT fk_company_invitation_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
