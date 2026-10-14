ALTER TABLE users
  ADD COLUMN verification_expires_at DATETIME NULL,
  ADD COLUMN password_reset_token_hash CHAR(64) NULL,
  ADD COLUMN password_reset_expires_at DATETIME NULL;

CREATE INDEX idx_users_password_reset_token ON users (password_reset_token_hash);

CREATE TABLE investor_email_challenges (
  email VARCHAR(320) NOT NULL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  institution VARCHAR(200) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uq_investor_email_challenge_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
