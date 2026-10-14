CREATE TABLE IF NOT EXISTS public_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title_pt VARCHAR(160) NOT NULL,
  title_en VARCHAR(160) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(100) NOT NULL UNIQUE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_public_documents_published_created (published, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
