import { createPool } from './connection.js';
import { mailAvailable } from '../auth-mail.js';

const pool = createPool();
try {
  const recipient = process.env.TEAM_NOTIFICATION_EMAIL?.trim() || 'investment@abiquifi.org.br';
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS recent,
      SUM(\`to\` = ?) AS addressed_to_team,
      SUM(\`to\` = ? AND sent = TRUE) AS delivered,
      SUM(\`to\` = ? AND sent = FALSE AND attempts < 8) AS pending,
      SUM(\`to\` = ? AND sent = FALSE AND ready_to_send = TRUE AND attempts < 8) AS ready,
      SUM(\`to\` = ? AND sent = FALSE AND attempts >= 8) AS exhausted,
      SUM(attempts) AS attempts,
      SUM(last_error IS NOT NULL) AS errors
    FROM email_outbox
    WHERE template = 'profile_submitted' AND created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY
  `, Array(5).fill(recipient));
  const status = rows[0];
  console.log('Review mail status:', JSON.stringify(status));
  console.log('SMTP configured:', mailAvailable());
} finally {
  await pool.end();
}
