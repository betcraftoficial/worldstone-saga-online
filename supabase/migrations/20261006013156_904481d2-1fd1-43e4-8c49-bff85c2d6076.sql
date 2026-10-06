CREATE TABLE public.ground_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL,
  qty integer NOT NULL CHECK (qty > 0 AND qty <= 1000),
  pos_x real NOT NULL,
  pos_z real NOT NULL,
  owner_character uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  protected_until timestamptz NOT NULL DEFAULT (now() + interval '30 seconds'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ground_drops TO authenticated;
GRANT ALL ON public.ground_drops TO service_role;
ALTER TABLE public.ground_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated players can view ground drops" ON public.ground_drops FOR SELECT TO authenticated USING (expires_at > now());
CREATE INDEX ground_drops_position_idx ON public.ground_drops (pos_x, pos_z);
CREATE INDEX ground_drops_expiry_idx ON public.ground_drops (expires_at);