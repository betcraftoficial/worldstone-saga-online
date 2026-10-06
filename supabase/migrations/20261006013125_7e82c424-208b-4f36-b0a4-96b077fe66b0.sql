ALTER TABLE public.arena_matches
  ADD COLUMN IF NOT EXISTS round_no integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS round_score_a integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS round_score_b integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eliminated uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS round_ends_at timestamptz;

ALTER TABLE public.arena_matches
  ADD CONSTRAINT arena_matches_round_no_check CHECK (round_no BETWEEN 1 AND 3),
  ADD CONSTRAINT arena_matches_round_score_a_check CHECK (round_score_a BETWEEN 0 AND 2),
  ADD CONSTRAINT arena_matches_round_score_b_check CHECK (round_score_b BETWEEN 0 AND 2);