-- Add direction and external_id columns to activities table.
--
-- direction: 'outbound' (agent sent) | 'inbound' (client replied)
--   Existing rows default to 'outbound' — they are all agent-initiated.
--
-- external_id: idempotency key for dedup.
--   SMS: Twilio MessageSid
--   Email: Gmail message ID
--   Null for manually-logged activities.

ALTER TABLE activities ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE INDEX IF NOT EXISTS activities_external_id_idx
  ON activities (external_id)
  WHERE external_id IS NOT NULL;
