-- Test recipients. Keep existing password hashes and company login unchanged.
UPDATE users AS target
LEFT JOIN users AS occupied ON occupied.email_normalized = 'isaque@brevia.company' AND occupied.id <> target.id
SET target.email = 'isaque@brevia.company'
WHERE target.id = 'u-team-1' AND target.role = 'team' AND occupied.id IS NULL;

UPDATE organizations
SET focal_point = JSON_SET(COALESCE(focal_point, JSON_OBJECT()), '$.email', 'workzaqviana@gmail.com')
WHERE id = 'imunotera';

UPDATE profile_versions
SET content = JSON_SET(content, '$.organization.focal_point.email', 'workzaqviana@gmail.com')
WHERE organization_id = 'imunotera' AND kind = 'draft';
