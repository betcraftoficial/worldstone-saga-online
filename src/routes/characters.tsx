import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { createCharacter, listCharacters } from "@/lib/game.functions";
import { VOCATION_LIST, VOCATIONS, type VocationId } from "@/game/data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/characters")({
  head: () => ({
    meta: [
      { title: "Seus personagens — Eldrath Online" },
      { name: "description", content: "Escolha ou crie seu herói em Eldrath Online." },
      { property: "og:title", content: "Seus personagens — Eldrath Online" },
      { property: "og:description", content: "Escolha ou crie seu herói em Eldrath Online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Characters,
});

function Characters() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listCharacters);
  const create = useServerFn(createCharacter);
  const q = useQuery({ queryKey: ["chars", user?.id], queryFn: () => list(), enabled: !!user });
  const [name, setName] = useState("");
  const [voc, setVoc] = useState<VocationId>("knight");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/" }); }, [loading, user, nav]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await create({ data: { name, vocation: voc } });
      await qc.invalidateQueries({ queryKey: ["chars"] });
      nav({ to: "/play", search: { c: r.id } });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }

  const v = VOCATIONS[voc];
  return (
    <div className="min-h-screen px-4 py-8 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="panel-title text-2xl font-black">ELDRATH</Link>
          <div className="flex gap-2">
            <Link to="/ranking" className="btn-wood px-3 py-1.5 text-sm">Ranking</Link>
            <button className="btn-wood px-3 py-1.5 text-sm" onClick={() => supabase.auth.signOut().then(() => nav({ to: "/" }))}>Sair</button>
          </div>
        </div>

        {(q.data?.length ?? 0) > 0 && (
          <section className="panel mb-8 p-5">
            <h2 className="panel-title mb-4 text-xl">Seus heróis</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {q.data!.map((c) => (
                <Link key={c.id} to="/play" search={{ c: c.id }} className="slot flex items-center justify-between p-4 transition hover:ring-2 hover:ring-ring">
                  <div>
                    <div className="font-display text-lg text-parchment">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{VOCATIONS[c.vocation as VocationId]?.name} · Nível {c.level}</div>
                  </div>
                  <span className="btn-gold px-3 py-1 text-sm">Jogar</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="panel p-5">
          <h2 className="panel-title mb-4 text-xl">Criar novo herói</h2>
          <form onSubmit={onCreate} className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {VOCATION_LIST.map((x) => (
                <button type="button" key={x.id} onClick={() => setVoc(x.id)}
                  className={`slot p-3 text-left transition ${voc === x.id ? "ring-2 ring-ring" : "opacity-80 hover:opacity-100"}`}>
                  <span className="mb-2 block h-1.5 w-10 rounded-full" style={{ background: x.color }} />
                  <div className="font-display text-parchment">{x.name}</div>
                  <div className="text-xs text-muted-foreground">{x.title}</div>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <h3 className="font-display text-2xl text-parchment">{v.name}</h3>
              <p className="text-sm text-foreground/85">{v.desc}</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Vida/nível: <b className="text-hp">{v.hpPerLevel}</b> · Mana/nível: <b className="text-mana">{v.manaPerLevel}</b></li>
                <li>Skill principal: <b className="text-parchment">{v.skillName}</b></li>
                <li>Passiva: <b className="text-primary">{v.passive.name}</b> — {v.passive.desc}</li>
                <li>Magias: {v.spells.map((s) => s.name).join(", ")}</li>
              </ul>
              <input className="slot w-full px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" placeholder="Nome do personagem" value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={18} required />
              <button disabled={busy} className="btn-gold w-full py-3">Criar e entrar no mundo</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
