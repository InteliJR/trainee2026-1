-- Eventos diferentes da EcoRota podem compartilhar a mesma revision.
-- A idempotência continua garantida por external_event_id.
DROP INDEX IF EXISTS "request_status_history_generation_revision_key";
CREATE INDEX "request_status_history_generation_revision_idx"
ON "request_status_history"("generation", "revision");
