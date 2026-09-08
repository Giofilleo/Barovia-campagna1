-- Da eseguire una volta nel SQL Editor del progetto Supabase, dopo 0001.
-- Aggiunge soltanto: nessuna colonna viene rimossa o ridefinita e nessun dato
-- esistente viene toccato. Puo essere rieseguita senza effetti.
BEGIN;
-- Segnalibro personale: fin dove ogni account ha letto le novita della campagna.
ALTER TABLE barovia.users ADD COLUMN IF NOT EXISTS seen bigint NOT NULL DEFAULT 0;
-- Stesure precedenti di ogni voce, per vedere cosa e cambiato e tornare indietro.
CREATE TABLE IF NOT EXISTS barovia.revisions (
 id text PRIMARY KEY, record_id text NOT NULL, at bigint NOT NULL, editor text NOT NULL,
 title text NOT NULL, body text NOT NULL DEFAULT '', data text NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_revisions_record ON barovia.revisions(record_id);
ALTER TABLE barovia.revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA barovia FROM PUBLIC, anon, authenticated;
COMMIT;
