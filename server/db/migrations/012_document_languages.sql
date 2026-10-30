ALTER TABLE public_documents ADD COLUMN language VARCHAR(4) NOT NULL DEFAULT 'pt';
ALTER TABLE public_documents ADD CONSTRAINT ck_public_documents_language CHECK (language IN ('pt','en','both'));
CREATE INDEX idx_public_documents_language ON public_documents (published,language,created_at);
