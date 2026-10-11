ALTER TABLE public.arena_matches ADD COLUMN IF NOT EXISTS heartbeats jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.arena_matches ADD COLUMN IF NOT EXISTS attack_ready jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS death_drop_enabled boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION public.storm_arena_tick(p_character uuid, p_target uuid DEFAULT NULL, p_damage integer DEFAULT 0, p_cooldown real DEFAULT 1, p_mana integer DEFAULT 0, p_action text DEFAULT 'auto') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.arena_matches%ROWTYPE; c public.characters%ROWTYPE; v public.characters%ROWTYPE; ids uuid[]; dead_ids uuid[]; winners uuid[]; losers uuid[]; cid uuid; side text; finished boolean := false; changed boolean := false; sa integer; sb integer; ax real; az real; bx real; bz real; mapname text; i integer; ready timestamptz;
BEGIN
 SELECT * INTO m FROM public.arena_matches WHERE status IN ('countdown','active') AND (p_character = ANY(team_a) OR p_character = ANY(team_b)) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('match',NULL); END IF;
 ids := m.team_a || m.team_b;
 m.heartbeats := jsonb_set(m.heartbeats, ARRAY[p_character::text], to_jsonb(now()::text));
 IF m.status = 'countdown' AND m.starts_at <= now() THEN m.status := 'active'; END IF;
 dead_ids := m.eliminated;
 IF m.status = 'active' THEN
  FOREACH cid IN ARRAY ids LOOP
   IF cid <> p_character AND COALESCE((m.heartbeats->>cid::text)::timestamptz, m.starts_at) < now() - interval '35 seconds' AND NOT(cid = ANY(dead_ids)) THEN dead_ids := array_append(dead_ids,cid); changed := true; END IF;
  END LOOP;
  IF p_target IS NOT NULL AND p_damage > 0 AND NOT(p_character = ANY(dead_ids)) AND NOT(p_target = ANY(dead_ids)) AND ((p_character = ANY(m.team_a) AND p_target = ANY(m.team_b)) OR (p_character = ANY(m.team_b) AND p_target = ANY(m.team_a))) THEN
   SELECT * INTO c FROM public.characters WHERE id=p_character FOR UPDATE;
   SELECT * INTO v FROM public.characters WHERE id=p_target FOR UPDATE;
   ready := COALESCE((m.attack_ready->>(p_character::text || ':' || p_action))::timestamptz, '1970-01-01'::timestamptz);
   IF ready <= now() AND c.mana >= p_mana THEN
    UPDATE public.characters SET hp=greatest(0,hp-least(p_damage,5000)) WHERE id=p_target RETURNING * INTO v;
    UPDATE public.characters SET mana=mana-p_mana WHERE id=p_character;
    m.attack_ready := jsonb_set(m.attack_ready, ARRAY[p_character::text || ':' || p_action], to_jsonb((now()+make_interval(secs=>greatest(0.4,p_cooldown)))::text));
    IF v.hp <= 0 THEN dead_ids := array_append(dead_ids,p_target); changed := true; END IF;
   END IF;
  END IF;
  IF m.team_a <@ dead_ids OR m.team_b <@ dead_ids THEN
   side := CASE WHEN m.team_a <@ dead_ids THEN 'b' ELSE 'a' END;
   sa := m.round_score_a + CASE WHEN side='a' THEN 1 ELSE 0 END;
   sb := m.round_score_b + CASE WHEN side='b' THEN 1 ELSE 0 END;
   finished := sa >= 2 OR sb >= 2;
   m.round_score_a := sa; m.round_score_b := sb;
   IF finished THEN
    m.status := 'finished'; m.winner := side; m.ends_at := now();
    winners := CASE WHEN side='a' THEN m.team_a ELSE m.team_b END;
    losers := CASE WHEN side='a' THEN m.team_b ELSE m.team_a END;
    IF NOT m.rewarded THEN
     UPDATE public.characters SET gold=gold+250, arena_wins=arena_wins+1, arena_rating=arena_rating+18 WHERE id=ANY(winners);
     UPDATE public.characters SET arena_losses=arena_losses+1, arena_rating=greatest(0,arena_rating-12) WHERE id=ANY(losers);
     m.rewarded := true;
    END IF;
    FOREACH cid IN ARRAY ids LOOP
     SELECT * INTO c FROM public.characters WHERE id=cid;
     ax := CASE c.home_city WHEN 'brisapor' THEN 175 WHEN 'duna_rubra' THEN -180 WHEN 'vale_sombrio' THEN -165 WHEN 'ferrogelo' THEN 170 ELSE 0 END;
     az := CASE c.home_city WHEN 'brisapor' THEN -115 WHEN 'duna_rubra' THEN -145 WHEN 'vale_sombrio' THEN 150 WHEN 'ferrogelo' THEN 165 ELSE 0 END;
     UPDATE public.characters SET pos_x=ax,pos_z=az+4,hp=CASE vocation WHEN 'knight' THEN 185+(level-1)*15 WHEN 'paladin' THEN 155+(level-1)*10 WHEN 'druid' THEN 125+(level-1)*5 WHEN 'sorcerer' THEN 120+(level-1)*5 ELSE 145+(level-1)*8 END, combat_until=NULL,last_save=now() WHERE id=cid;
    END LOOP;
    UPDATE public.arena_queue SET status='finished' WHERE character_id=ANY(ids);
   ELSE
    m.status := 'countdown'; m.round_no := m.round_no+1; m.starts_at := now()+interval '8 seconds'; dead_ids := '{}'; m.attack_ready := '{}';
    m.map_id := CASE m.map_id WHEN 'cripta' THEN 'ponte' WHEN 'ponte' THEN 'ruinas' ELSE 'cripta' END;
    ax := CASE m.map_id WHEN 'ponte' THEN -18 WHEN 'ruinas' THEN -15 ELSE -12 END;
    az := CASE m.map_id WHEN 'ponte' THEN -212 WHEN 'ruinas' THEN -192 ELSE -205 END;
    bx := -ax; bz := -410-az;
    i:=0; FOREACH cid IN ARRAY m.team_a LOOP
     UPDATE public.characters SET pos_x=ax,pos_z=az+i*2, hp=CASE vocation WHEN 'knight' THEN 185+(level-1)*15 WHEN 'paladin' THEN 155+(level-1)*10 WHEN 'druid' THEN 125+(level-1)*5 WHEN 'sorcerer' THEN 120+(level-1)*5 ELSE 145+(level-1)*8 END, mana=CASE vocation WHEN 'knight' THEN 35+(level-1)*5 WHEN 'paladin' THEN 70+(level-1)*15 WHEN 'druid' THEN 110+(level-1)*30 WHEN 'sorcerer' THEN 120+(level-1)*30 ELSE 55+(level-1)*10 END, last_save=now() WHERE id=cid; i:=i+1;
    END LOOP;
    i:=0; FOREACH cid IN ARRAY m.team_b LOOP
     UPDATE public.characters SET pos_x=bx,pos_z=bz+i*2, hp=CASE vocation WHEN 'knight' THEN 185+(level-1)*15 WHEN 'paladin' THEN 155+(level-1)*10 WHEN 'druid' THEN 125+(level-1)*5 WHEN 'sorcerer' THEN 120+(level-1)*5 ELSE 145+(level-1)*8 END, mana=CASE vocation WHEN 'knight' THEN 35+(level-1)*5 WHEN 'paladin' THEN 70+(level-1)*15 WHEN 'druid' THEN 110+(level-1)*30 WHEN 'sorcerer' THEN 120+(level-1)*30 ELSE 55+(level-1)*10 END, last_save=now() WHERE id=cid; i:=i+1;
    END LOOP;
   END IF;
  END IF;
 END IF;
 UPDATE public.arena_matches SET status=m.status,heartbeats=m.heartbeats,attack_ready=m.attack_ready,eliminated=dead_ids,round_no=m.round_no,round_score_a=m.round_score_a,round_score_b=m.round_score_b,map_id=m.map_id,starts_at=m.starts_at,winner=m.winner,ends_at=m.ends_at,rewarded=m.rewarded WHERE id=m.id RETURNING * INTO m;
 RETURN jsonb_build_object('match',to_jsonb(m),'finished',finished,'changed',changed);
END;
$$;
REVOKE ALL ON FUNCTION public.storm_arena_tick(uuid,uuid,integer,real,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.storm_arena_tick(uuid,uuid,integer,real,integer,text) TO service_role;