CREATE TABLE public.guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  tag text NOT NULL,
  owner_character uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guilds TO authenticated, anon;
GRANT ALL ON public.guilds TO service_role;
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guilds readable" ON public.guilds FOR SELECT USING (true);

CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL UNIQUE,
  vocation text NOT NULL,
  home_city text NOT NULL DEFAULT 'aldoria',
  level int NOT NULL DEFAULT 1,
  exp bigint NOT NULL DEFAULT 0,
  hp int NOT NULL DEFAULT 150,
  mana int NOT NULL DEFAULT 50,
  magic_level int NOT NULL DEFAULT 0,
  ml_progress real NOT NULL DEFAULT 0,
  skill_level int NOT NULL DEFAULT 10,
  skill_progress real NOT NULL DEFAULT 0,
  gold bigint NOT NULL DEFAULT 100,
  bank bigint NOT NULL DEFAULT 0,
  pos_x real NOT NULL DEFAULT 0,
  pos_z real NOT NULL DEFAULT 0,
  inventory jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipment jsonb NOT NULL DEFAULT '{}'::jsonb,
  outfit text NOT NULL DEFAULT 'aventureiro',
  mount text,
  owned_outfits text[] NOT NULL DEFAULT ARRAY['aventureiro'],
  owned_mounts text[] NOT NULL DEFAULT ARRAY[]::text[],
  xp_boost_until timestamptz,
  skull text NOT NULL DEFAULT 'none',
  skull_until timestamptz,
  frags int NOT NULL DEFAULT 0,
  deaths int NOT NULL DEFAULT 0,
  monsters_killed int NOT NULL DEFAULT 0,
  guild_id uuid REFERENCES public.guilds(id) ON DELETE SET NULL,
  quests jsonb NOT NULL DEFAULT '{}'::jsonb,
  kill_window jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_save timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX characters_user_idx ON public.characters(user_id);
CREATE INDEX characters_rank_idx ON public.characters(level DESC, exp DESC);
GRANT SELECT ON public.characters TO authenticated, anon;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "characters readable" ON public.characters FOR SELECT USING (true);

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own purchases" ON public.purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_character uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  to_character uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  qty int NOT NULL DEFAULT 1,
  price bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades involving own chars" ON public.trades FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.characters c WHERE c.user_id = auth.uid() AND (c.id = from_character OR c.id = to_character))
);