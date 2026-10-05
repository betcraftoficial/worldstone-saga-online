import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VOCATIONS, VOCATION_LIST, type VocationId } from "@/game/data";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — Eldrath Online" },
      { name: "description", content: "Os maiores heróis de Eldrath: ranking por nível, magic level e PvP." },
      { property: "og:title", content: "Ranking — Eldrath Online" },
      { property: "og:description", content: "Os maiores heróis de Eldrath: ranking por nível, magic level e PvP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ranking,
});

type Row = { id: string; name: string; vocation: VocationId; level: number; magic_level: number; skill_level: number; frags: number; monsters_killed: number };

function Ranking() {
  const [by, setBy] = useState<"level" | "magic_level" | "skill_level" | "frags">("level");
  const [voc, setVoc] = useState<VocationId | "all">("all");
  const q = useQuery({
    queryKey: ["ranking", by, voc],
    queryFn: async () => {
      let qr = supabase.from("characters").select("id,name,vocation,level,magic_level,skill_level,frags,monsters_killed").order(by, { ascending: false }).limit(50);
      if (voc !== "all") qr = qr.eq("vocation", voc);
      const { data } = await qr;
      return (data ?? []) as Row[];
    },
  });
  const tabs = [["level", "Nível"], ["magic_level", "Magic Level"], ["skill_level", "Skill"], ["frags", "PvP"]] as const;
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="panel-title text-2xl font-black">ELDRATH</Link>
          <Link to="/characters" className="btn-gold px-4 py-1.5 text-sm">Jogar</Link>
        </div>
        <div className="panel p-5">
          <h1 className="panel-title mb-4 text-3xl">Ranking</h1>
          <div className="mb-3 flex flex-wrap gap-2">
            {tabs.map(([k, l]) => <button key={k} onClick={() => setBy(k)} className={by === k ? "btn-gold px-3 py-1 text-sm" : "btn-wood px-3 py-1 text-sm"}>{l}</button>)}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={() => setVoc("all")} className={voc === "all" ? "btn-gold px-2 py-0.5 text-xs" : "btn-wood px-2 py-0.5 text-xs"}>Todas</button>
            {VOCATION_LIST.map((v) => <button key={v.id} onClick={() => setVoc(v.id)} className={voc === v.id ? "btn-gold px-2 py-0.5 text-xs" : "btn-wood px-2 py-0.5 text-xs"}>{v.name}</button>)}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-2">#</th><th>Nome</th><th>Vocação</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {q.data?.map((r, i) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="py-2 font-display text-primary">{i + 1}</td>
                  <td className="text-parchment">{r.name}</td>
                  <td className="text-muted-foreground">{VOCATIONS[r.vocation]?.name}</td>
                  <td className="text-right font-bold">{r[by]}</td>
                </tr>
              ))}
              {q.data?.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Nenhum herói ainda. Seja o primeiro!</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
