import { createPool } from './connection.js';

const pool = createPool();
try {
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS recent,
      SUM(\`to\` = 'isaque@brevia.company') AS addressed_to_team,
      SUM(\`to\` = 'isaque@brevia.company' AND sent = TRUE) AS delivered,
      SUM(\`to\` = 'isaque@brevia.company' AND sent = FALSE AND attempts < 8) AS pending,
      SUM(\`to\` = 'isaque@brevia.company' AND sent = FALSE AND ready_to_send = TRUE AND attempts < 8) AS ready,
      SUM(\`to\` = 'isaque@brevia.company' AND sent = FALSE AND attempts >= 8) AS exhausted,
      SUM(attempts) AS attempts,
      SUM(last_error IS NOT NULL) AS errors
    FROM email_outbox
    WHERE template = 'profile_submitted' AND created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY
  `);
  const status = rows[0];
  console.log('Review mail status:', JSON.stringify(status));
  console.log('SMTP configured:', Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM && process.env.PUBLIC_ORIGIN));
} finally {
  await pool.end();
}
