UPDATE email_outbox
SET ready_to_send = TRUE
WHERE template = 'profile_submitted'
  AND sent = FALSE
  AND attempts < 8
  AND created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY;
