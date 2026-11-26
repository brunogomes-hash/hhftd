import type React from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import bravaAnim from "@/assets/raposa-brava-luft.webp.asset.json";
import felizAnim from "@/assets/raposa-feliz-luft2.webp.asset.json";
import cadeAnim from "@/assets/raposa-cade-luft.webp.asset.json";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchResumoB2B, fetchResumoB2C } from "@/lib/b2c.functions";
import { FAIXA, horaAnterior, humorRaposa, montarPainel, type Canal, type HoraLinha, type Status } from "@/lib/produtividade";
import { cn } from "@/lib/utils";
import { Comemoracao } from "@/components/Comemoracao";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

const COR: Record<Status, string> = {
  abaixo: "bg-destructive",
  semVolume: "bg-warning",
  dentro: "bg-success",
  acima: "bg-over",
  futura: "bg-muted",
};
const TXT: Record<Status, string> = { abaixo: "text-destructive", semVolume: "text-warning", dentro: "text-success", acima: "text-over", futura: "text-muted-foreground" };
const ROTULO: Record<Status, string> = { abaixo: "Fora", semVolume: "Sem volume", dentro: "Dentro", acima: "Passou", futura: "—" };

/** Painel desenhado em 1920×1080 e escalado para caber inteiro em qualquer tela. */
function useEscalaTela() {
  const [e, setE] = useState(0);
  useEffect(() => {
    const f = () => setE(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return e;
}

function useAgora() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

const KEY = "painel-rotacao";
function useRotacao(canal: Canal, comemorando: boolean) {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<{ seg: number; pausado: boolean } | null>(null);
  const [restante, setRestante] = useState(0);
  useEffect(() => {
    let c = { seg: 30, pausado: false };
    try { c = { ...c, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { /* ignore */ }
    setCfg(c);
  }, []);
  useEffect(() => { if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg)); }, [cfg]);
  useEffect(() => {
    if (!cfg || cfg.pausado || comemorando) return;
    let r = cfg.seg;
    setRestante(r);
    const t = setInterval(() => {
      r -= 1;
      setRestante(r);
      if (r <= 0) { clearInterval(t); void navigate({ to: canal === "B2C" ? "/b2b" : "/" }); }
    }, 1000);
    return () => clearInterval(t);
  }, [cfg, canal, navigate, comemorando]);
  return { cfg, setCfg, restante };
}

function ControleApresentacao({ canal, comemorando, extra }: { canal: Canal; comemorando: boolean; extra?: React.ReactNode }) {
  const { cfg, setCfg, restante } = useRotacao(canal, comemorando);
  if (!cfg) return null;
  const tela = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  return (
    <div className="flex items-center gap-2 rounded-md bg-card px-2 py-1">
      <button onClick={() => setCfg({ ...cfg, pausado: !cfg.pausado })} aria-label={cfg.pausado ? "Continuar apresentação" : "Pausar apresentação"}
        className={cn("rounded px-3 py-1.5 font-display text-base font-bold", cfg.pausado ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted")}>
        {cfg.pausado ? "▶ Continuar" : "❚❚ Pausar"}
      </button>
      <label className="flex items-center gap-1 text-sm text-muted-foreground">
        <input type="number" min={5} max={600} value={cfg.seg} aria-label="Segundos por página"
          onChange={(e) => setCfg({ ...cfg, seg: Math.max(5, Math.min(600, Number(e.target.value) || 5)) })}
          className="w-16 rounded bg-secondary px-2 py-1 text-center font-mono text-base text-foreground" />
        seg
      </label>
      <span className="w-10 text-right font-mono text-sm text-primary">{cfg.pausado || comemorando ? "—" : `${restante}s`}</span>
      <button onClick={() => void tela()} aria-label="Tela cheia" className="rounded bg-secondary px-2 py-1.5 text-base hover:bg-muted">⛶</button>
      {extra}
    </div>
  );
}

export function PainelProdutividade({ canal }: { canal: Canal }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const canalTela = pathname === "/b2b" ? "B2B" : pathname === "/" ? "B2C" : "";
  const agora = useAgora();
  const escalaTela = useEscalaTela();
  const [resultadoHora, setResultadoHora] = useState<string | null>(null);
  useEffect(() => {
    if (!resultadoHora) return;
    const timer = setTimeout(() => setResultadoHora(null), 20_000);
    return () => clearTimeout(timer);
  }, [resultadoHora]);
  useEffect(() => { setResultadoHora(null); }, [canal]);
  const buscarB2C = useServerFn(fetchResumoB2C);
  const dia = agora ? `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}` : "";
  const b2c = useQuery({
    queryKey: ["resumo-b2c", dia],
    queryFn: () => buscarB2C({ data: { dia } }),
    enabled: !!dia,
    refetchInterval: 2 * 60 * 1000,
  });
  const buscarB2B = useServerFn(fetchResumoB2B);
  const b2b = useQuery({
    queryKey: ["resumo-b2b", dia],
    queryFn: () => buscarB2B({ data: { dia } }),
    enabled: !!dia,
    refetchInterval: 2 * 60 * 1000,
  });
  if (!agora || !escalaTela) return <div className="min-h-screen bg-background" />;
  const realB2C = b2c.data
    ? montarPainel("B2C", b2c.data.forecastDia, b2c.data.realPorHora, agora.getHours(), b2c.data.caixa, agora.getMinutes(), b2c.data.volumePorHora)
    : null;
  const vazio = (c: Canal) => montarPainel(c, 0, {}, agora.getHours(), { pecas: 0, pedidos: 0 }, agora.getMinutes());
  const realB2B = b2b.data
    ? montarPainel("B2B", b2b.data.forecastDia, b2b.data.realPorHora, agora.getHours(), b2b.data.caixa, agora.getMinutes())
    : null;
  const outros = { B2C: realB2C ?? vazio("B2C"), B2B: realB2B ?? vazio("B2B") };
  const fonte = canal === "B2B" ? b2b : b2c;
  const p = outros[canal];
  const ok = p.atingido >= FAIXA.min;
  const escala = Math.max(...p.horas.map((l) => Math.max(l.meta, l.real))) * 1.08;

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
    <div className="absolute left-1/2 top-1/2 flex h-[1080px] w-[1920px] flex-col gap-4 bg-background p-5 text-foreground"
      style={{ transform: `translate(-50%, -50%) scale(${escalaTela})` }}>
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
            Produtividade <span className="text-primary">hora a hora</span>
          </h1>
          <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {fonte.isError ? "ERRO AO LER PLANILHA" : fonte.data ? `SENIOR · ${new Date(fonte.data.atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "CARREGANDO…"}
          </span>
        </div>
        <nav className="flex gap-2">
          {(["B2C", "B2B"] as Canal[]).map((c) => (
            <Link key={c} to={c === "B2C" ? "/" : "/b2b"}
              aria-disabled={!!resultadoHora} onClick={(event) => { if (resultadoHora) event.preventDefault(); }}
              className={cn("rounded-md px-5 py-2 font-display text-xl font-bold transition-colors",
                c === canal ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted")}>
              {c}
            </Link>
          ))}
          <ControleApresentacao canal={canal} comemorando={!!resultadoHora} extra={<Comemoracao canal={canal} canalTela={canalTela} dia={dia} horaAtual={agora.getHours()} linha={p.horas.find((l) => l.hora === horaAnterior(agora.getHours()))} onResultado={setResultadoHora} />} />
          <div className="ml-1 rounded-md bg-card px-4 py-2 font-mono text-xl font-bold">
            {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </nav>
      </header>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Quadro lateral ~30% */}
        <aside className="flex min-h-0 w-[30%] min-w-[340px] flex-col gap-4">
          <section className="panel p-4">
            <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-muted-foreground">Na caixa agora</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["B2C", "B2B"] as Canal[]).map((c) => (
                <div key={c} className={cn("rounded-lg border p-3", c === canal ? "border-primary bg-primary/10" : "border-border bg-secondary/40")}>
                  <div className="font-display text-xl font-extrabold text-primary">{c}</div>
                  <div className="mt-1 font-mono text-3xl font-bold leading-none">{fmt(outros[c].caixa.pecas)}</div>
                  <div className="text-xs uppercase text-muted-foreground">peças</div>
                  <div className="mt-2 font-mono text-xl font-bold leading-none">{fmt(outros[c].caixa.pedidos)}</div>
                  <div className="text-xs uppercase text-muted-foreground">pedidos</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel flex min-h-0 flex-1 flex-col gap-3 p-4">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-muted-foreground">{canal} · hoje</h2>
            <div className="grid shrink-0 grid-cols-3 gap-2">
              <Kpi label="Forecast do dia" valor={fmt(p.forecastDia)} unidade="peças" />
              <Kpi label={`Forecast até ${hh(agora.getHours())}`} valor={fmt(p.forecastAteAgora)} unidade="peças" />
              <Kpi label="Realizado até agora" valor={fmt(p.realizadoAteAgora)} unidade="peças" />
            </div>
            <div className="min-h-0 flex-1">
              <Raposa humor={humorRaposa(p)} />
            </div>
            <div className="relative rounded-xl border border-border bg-background/40 p-4">
              <div className="text-sm uppercase tracking-wide text-muted-foreground">Atingimento</div>
              <div className={cn("font-display text-7xl font-extrabold leading-none", ok ? "text-success" : p.semVolume ? "text-warning" : "text-destructive")}>
                {(p.atingido * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", ok ? "bg-success" : p.semVolume ? "bg-warning" : "bg-destructive")} style={{ width: `${Math.min(p.atingido, 1) * 100}%` }} />
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {ok ? "Estamos dentro da meta!" : p.semVolume ? "Abaixo da meta por falta de pedidos" : `Faltam ${fmt(p.forecastAteAgora - p.realizadoAteAgora)} peças para a meta`}
              </div>
            </div>
          </section>
        </aside>

        {/* Barras por hora */}
        <main className="panel relative flex min-w-0 flex-1 flex-col px-5 pb-4 pt-6">
          <div className="hazard absolute inset-x-0 top-0 h-1.5 rounded-t-[var(--radius)] opacity-70" />
          {resultadoHora && (
            <div role="status" aria-label="Resultado da hora fechada" className="absolute left-4 right-4 top-3 z-10 flex h-16 items-center overflow-hidden border-y-2 border-primary bg-secondary text-primary">
              <div className="letreiro-hora flex w-max shrink-0 items-center gap-16 whitespace-nowrap font-mono text-2xl font-bold uppercase">
                <span>{resultadoHora}</span><span aria-hidden="true">{resultadoHora}</span>
              </div>
            </div>
          )}
          <div className="mb-2 flex items-center justify-end gap-5 text-sm text-muted-foreground">
            <Legenda cls="border-2 border-dashed border-foreground/60" txt="Ideal da hora" />
            <Legenda cls="bg-primary" txt="Ideal até agora" />
            <Legenda cls="bg-destructive" txt="Fora" />
            <Legenda cls="bg-warning" txt="Sem volume" />
            <Legenda cls="bg-success" txt="Dentro" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-between">
            {p.horas.map((l, i) => <Linha key={l.hora} l={l} escala={escala} i={i} />)}
          </div>
        </main>
      </div>
    </div>
    </div>
  );
}

function Kpi({ label, valor, unidade }: { label: string; valor: string; unidade: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-2.5 py-2">
      <div className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-3xl font-bold leading-tight">{valor} <span className="text-xs font-medium text-muted-foreground">{unidade}</span></div>
    </div>
  );
}

function Legenda({ cls, txt }: { cls: string; txt: string }) {
  return <span className="flex items-center gap-2"><span className={cn("inline-block h-3 w-6 rounded-sm", cls)} />{txt}</span>;
}

function Linha({ l, escala, i }: { l: HoraLinha; escala: number; i: number }) {
  const pct = l.meta ? Math.round((l.real / l.meta) * 100) : null;
  return (
    <div className={cn("grid grid-cols-[4.5rem_1fr_9rem] items-center gap-3 rounded-md px-2", l.atual && "bg-primary/10 ring-1 ring-primary")}>
      <span className={cn("font-mono text-lg font-bold", l.atual ? "text-primary" : l.status === "futura" ? "text-muted-foreground" : "")}>{hh(l.hora)}</span>
      <div className="relative h-[1.6rem]">
        {l.meta > 0 ? (
          <div className="absolute inset-y-0 left-0 rounded-sm border-2 border-dashed border-foreground/50 bg-foreground/5" style={{ width: `${(l.meta / escala) * 100}%` }} />
        ) : (
          <div className="absolute inset-y-0 left-0 flex items-center text-xs uppercase tracking-widest text-muted-foreground">intervalo · sem meta</div>
        )}
        {l.real > 0 && (
          <div className={cn("animate-bar-in absolute inset-y-1 left-0 rounded-sm", COR[l.status])}
            style={{ width: `${(l.real / escala) * 100}%`, animationDelay: `${i * 40}ms` }} />
        )}
        {l.atual && l.meta > 0 && (
          <div className="absolute -inset-y-1.5 z-[1] w-1 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" style={{ left: `${(l.idealAgora / escala) * 100}%` }}>
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-1.5 font-mono text-[11px] font-bold leading-4 text-primary-foreground">
              ideal agora {fmt(l.idealAgora)}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-end gap-2 font-mono">
        <span className="text-base font-bold">{l.atual ? `${fmt(l.real)}/${fmt(l.idealAgora)}` : l.status === "futura" ? fmt(l.meta) : `${fmt(l.real)}/${fmt(l.meta)}`}</span>
        <span className={cn("w-14 text-right text-sm font-bold", TXT[l.status])}>{l.atual && l.idealAgora ? `${Math.round((l.real / l.idealAgora) * 100)}%` : pct === null || l.status === "futura" ? ROTULO[l.status] : `${pct}%`}</span>
      </div>
    </div>
  );
}

const RAPOSA = {
  feliz: { img: felizAnim.url, alt: "Raposa feliz: dentro da meta", anim: undefined, frase: "Bora, time!", cor: "bg-success text-primary-foreground", asp: "488/450" },
  cade: { img: cadeAnim.url, alt: "Raposa de braços abertos: falta volume", anim: undefined, frase: "Cadê os pedidos?", cor: "bg-warning text-primary-foreground", asp: "480/460" },
  brava: { img: bravaAnim.url, alt: "Raposa brava: fora da meta", anim: undefined, frase: "Acelera aí!", cor: "bg-destructive text-destructive-foreground", asp: "334/442" },
} as const;

function Raposa({ humor }: { humor: keyof typeof RAPOSA }) {
  const r = RAPOSA[humor];
  return (
    <div className="pointer-events-none relative z-10 flex h-full w-full flex-col items-center justify-end gap-1.5">
      <div className={cn("relative z-20 w-fit max-w-full shrink-0 rounded-xl px-4 py-1.5 text-center font-display text-4xl font-extrabold uppercase leading-tight shadow-[0_4px_18px_rgba(0,0,0,0.55)]", r.cor)}>
        {r.frase}
      </div>
      <img src={r.img} alt={r.alt} className="min-h-0 w-full max-h-full object-contain object-bottom" style={{ aspectRatio: r.asp }} />
    </div>
  );
}
