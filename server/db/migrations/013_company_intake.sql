ALTER TABLE organizations ADD COLUMN intake_mode VARCHAR(16) NOT NULL DEFAULT 'legacy';
ALTER TABLE organizations ADD CONSTRAINT ck_org_intake_mode CHECK (intake_mode IN ('legacy','self','invite'));
ALTER TABLE profile_versions DROP CHECK ck_profile_version_status;
ALTER TABLE profile_versions ADD CONSTRAINT ck_profile_version_status CHECK (status IN ('filling','in_review','returned','rejected','published'));
