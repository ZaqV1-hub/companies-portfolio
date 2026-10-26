-- Deliver recent review notices to the Abiquifi test inbox even if an older
-- team user address was selected when the event entered the outbox.
UPDATE email_outbox
SET `to` = 'isaque@brevia.company', sent = FALSE, attempts = 0, last_error = NULL
WHERE template = 'profile_submitted'
  AND (`to` <> 'isaque@brevia.company' OR sent = FALSE)
  AND created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY;
