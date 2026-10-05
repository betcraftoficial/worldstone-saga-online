ALTER TABLE public.characters
  ADD COLUMN tutorial_step integer NOT NULL DEFAULT 0,
  ADD COLUMN combat_until timestamp with time zone,
  ADD COLUMN arena_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN arena_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN arena_rating integer NOT NULL DEFAULT 1000;

CREATE TABLE public.arena_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  mode text NOT NULL,
  team_code text,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (character_id),
  CONSTRAINT arena_queue_mode_valid CHECK (mode IN ('1v1', '2v2', '3v3', '5v5')),
  CONSTRAINT arena_queue_status_valid CHECK (status IN ('queued', 'matched', 'cancelled'))
);
GRANT SELECT ON public.arena_queue TO authenticated;
GRANT ALL ON public.arena_queue TO service_role;
ALTER TABLE public.arena_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can read own arena queue"
  ON public.arena_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.arena_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL,
  map_id text NOT NULL,
  team_a uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  team_b uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  score_a integer NOT NULL DEFAULT 0,
  score_b integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'countdown',
  winner text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone,
  rewarded boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT arena_matches_mode_valid CHECK (mode IN ('1v1', '2v2', '3v3', '5v5')),
  CONSTRAINT arena_matches_status_valid CHECK (status IN ('countdown', 'active', 'finished', 'cancelled')),
  CONSTRAINT arena_matches_winner_valid CHECK (winner IS NULL OR winner IN ('a', 'b', 'draw'))
);
GRANT SELECT ON public.arena_matches TO authenticated;
GRANT ALL ON public.arena_matches TO service_role;
ALTER TABLE public.arena_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can read their arena matches"
  ON public.arena_matches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.user_id = auth.uid()
        AND (c.id = ANY(arena_matches.team_a) OR c.id = ANY(arena_matches.team_b))
    )
  );

CREATE OR REPLACE FUNCTION public.storm_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_arena_queue_updated_at
BEFORE UPDATE ON public.arena_queue
FOR EACH ROW EXECUTE FUNCTION public.storm_set_updated_at();

CREATE TRIGGER set_arena_matches_updated_at
BEFORE UPDATE ON public.arena_matches
FOR EACH ROW EXECUTE FUNCTION public.storm_set_updated_at();