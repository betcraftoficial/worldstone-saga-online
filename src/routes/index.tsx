import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import hero from "@/assets/hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { VOCATION_LIST } from "@/game/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eldrath Online — Jogue o MMORPG 3D grátis no navegador" },
      { name: "description", content: "Crie seu herói entre 5 vocações, cace monstros, enfrente chefes e jogadores em um mundo aberto online compartilhado. PC e celular." },
      { property: "og:title", content: "Eldrath Online — MMORPG 3D grátis" },
      { property: "og:description", content: "5 vocações, PvP com skulls, guilds, mercado e chefes lendários. Direto no navegador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) toast.success("Conta criada! Confirme pelo link enviado ao seu email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/characters" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <img src={hero} alt="Mundo de Eldrath" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
      <header className="relative z-10 flex items-center justify-between px-5 py-4 md:px-10">
        <span className="panel-title text-xl font-black md:text-2xl">ELDRATH</span>
        <Link to="/ranking" className="btn-wood px-3 py-1.5 text-sm">Ranking</Link>
      </header>
      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.2fr_1fr] md:px-10 md:pt-16">
        <section className="animate-fade-in">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-primary">MMORPG 3D · Online · Grátis</p>
          <h1 className="text-glow text-5xl font-black leading-[1.05] text-parchment md:text-7xl">Eldrath<br />Online</h1>
          <p className="mt-5 max-w-lg text-lg text-foreground/90">
            Um mundo aberto compartilhado com cinco cidades, cavernas, desertos gelados e dragões antigos. Forme parties, crie sua guild e marque seu nome no PvP.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {VOCATION_LIST.map((v) => (
              <span key={v.id} className="panel px-3 py-1.5 text-sm">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: v.color }} />
                {v.name}
              </span>
            ))}
          </div>
        </section>

        <section className="panel p-6 md:p-8">
          {user ? (
            <div className="text-center">
              <h2 className="panel-title text-2xl">Bem-vindo de volta</h2>
              <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
              <Link to="/characters" className="btn-gold mt-6 block py-3 text-lg">Jogar agora</Link>
              <button className="mt-3 text-sm text-muted-foreground underline" onClick={() => supabase.auth.signOut()}>Sair</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="panel-title text-2xl">{mode === "login" ? "Entrar no mundo" : "Criar conta"}</h2>
              <input className="slot w-full px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
              <input className="slot w-full px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} />
              <button disabled={busy} className="btn-gold w-full py-3 text-lg">{mode === "login" ? "Entrar" : "Cadastrar"}</button>
              <button type="button" onClick={google} className="btn-wood w-full py-2.5">Continuar com Google</button>
              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? "Novo por aqui?" : "Já tem conta?"}{" "}
                <button type="button" className="text-primary underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                  {mode === "login" ? "Criar conta" : "Entrar"}
                </button>
              </p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
