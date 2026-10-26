ALTER TABLE organizations ADD COLUMN invitation_email VARCHAR(320) NULL;

UPDATE organizations
SET invitation_email = LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(focal_point, '$.email'))))
WHERE JSON_UNQUOTE(JSON_EXTRACT(focal_point, '$.email')) IS NOT NULL;
