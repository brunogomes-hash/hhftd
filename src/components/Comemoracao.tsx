import { useEffect, useRef, useState } from "react";
import { podeComemorarNaTela, proximaFala, textoResultadoHora, DURACAO_COMEMORACAO } from "@/lib/comemoracao";
import type { HoraLinha } from "@/lib/produtividade";
import { RaposaGigante } from "@/components/RaposaGigante";
import { ativarAudio, audioLiberado, pararAudio, precarregarAudios, tocarComemoracao } from "@/lib/audio-comemoracao";
import { Button } from "@/components/ui/button";

const KEY_SOM = "painel-som";

/** Fogos de artifício: foguetes sobem e explodem em faíscas pela tela inteira. */
function soltarFogos(): () => void {
  const c = document.createElement("canvas");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:9999;pointer-events:none";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  if (!ctx) { c.remove(); return () => {}; }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = () => (c.width = Math.floor(window.innerWidth * dpr));
  const h = () => (c.height = Math.floor(window.innerHeight * dpr));
  w(); h();
  const cores = ["#ffd23f", "#12d1a0", "#ff5a5f", "#3b82f6", "#ffffff", "#ffb300"];
  type Faisca = { x: number; y: number; vx: number; vy: number; vida: number; cor: string; r: number };
  type Foguete = { x: number; y: number; vy: number; alvo: number; cor: string };
  const faisca: Faisca[] = [];
  const foguetes: Foguete[] = [];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const explodir = (x: number, y: number, cor: string) => {
    const n = 46 + Math.floor(Math.random() * 34);
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + rnd(-0.12, 0.12);
      const vel = rnd(2.2, 8.2) * dpr;
      faisca.push({ x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vida: rnd(48, 96), cor: Math.random() < 0.25 ? "#ffffff" : cor, r: rnd(1.2, 2.8) * dpr });
    }
  };
  const lancar = () => {
    foguetes.push({ x: rnd(0.12, 0.88) * c.width, y: c.height, vy: -rnd(13, 19) * dpr, alvo: rnd(0.12, 0.5) * c.height, cor: cores[Math.floor(Math.random() * cores.length)] ?? "#ffd23f" });
  };
  const t0 = performance.now();
  let ultimoLanc = 0;
  let raf = 0;
  const frame = (t: number) => {
    const decorrido = t - t0;
    ctx.clearRect(0, 0, c.width, c.height);
    if (decorrido < 17000 && t - ultimoLanc > 320) { ultimoLanc = t; lancar(); if (Math.random() < 0.35) lancar(); }
    for (let i = foguetes.length - 1; i >= 0; i--) {
      const f = foguetes[i];
      if (!f) { foguetes.splice(i, 1); continue; }
      f.y += f.vy;
      f.vy += 0.16 * dpr;
      ctx.fillStyle = f.cor;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 2.4 * dpr, 0, Math.PI * 2);
      ctx.fill();
      if (f.vy > -1.5 || f.y <= f.alvo) { explodir(f.x, f.y, f.cor); foguetes.splice(i, 1); }
    }
    for (let i = faisca.length - 1; i >= 0; i--) {
      const p = faisca[i];
      if (!p) { faisca.splice(i, 1); continue; }
      p.x += p.vx; p.y += p.vy; p.vy += 0.09 * dpr; p.vx *= 0.985; p.vida -= 1;
      if (p.vida <= 0) { faisca.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.vida / 34);
      ctx.fillStyle = p.cor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (decorrido < DURACAO_COMEMORACAO || faisca.length || foguetes.length) raf = requestAnimationFrame(frame);
    else { cancelAnimationFrame(raf); c.remove(); }
  };
  lancar(); lancar(); lancar();
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); c.remove(); };
}

/**
 * Celebrate only the visible channel's closed hour at 100% or above.
 * One player handles applause → narration → applause and reports playback blocks.
 */
export function Comemoracao({ canal, canalTela, dia, linha, horaAtual, onResultado }: { canal: string; canalTela: string; dia: string; linha: HoraLinha | undefined; horaAtual: number; onResultado: (t: string) => void }) {
  const [som, setSom] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [falando, setFalando] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [erroSom, setErroSom] = useState(false);
  const [fala, setFala] = useState<{ n: number; texto: string } | null>(null);
  const cancelarFogos = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSom(localStorage.getItem(KEY_SOM) === "1");
    setPronto(audioLiberado());
    precarregarAudios();
    const atualizar = () => setVisivel(document.visibilityState === "visible");
    atualizar();
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      document.removeEventListener("visibilitychange", atualizar);
      pararAudio();
      cancelarFogos.current?.();
    };
  }, []);

  useEffect(() => {
    if (visivel && canal === canalTela) return;
    pararAudio();
    cancelarFogos.current?.();
    setFala(null);
    setFalando(false);
  }, [visivel, canal, canalTela]);

  const disparar = (texto: string) => {
    if (!visivel || canal !== canalTela || fala) return;
    const n = proximaFala();
    setFala({ n, texto });
    cancelarFogos.current?.();
    cancelarFogos.current = soltarFogos();
    if (localStorage.getItem(KEY_SOM) === "1") {
      tocarComemoracao(n, setFalando, () => { setPronto(false); setErroSom(true); });
    }
  };

  useEffect(() => {
    const k = `observado:${canal}:${dia}`;
    if (!linha || fala || linha.hora <= Number(localStorage.getItem(k) ?? "-1") || !podeComemorarNaTela(linha, horaAtual, canal, canalTela, visivel)) return;
    const k2 = `comemorado:${canal}:${dia}:${linha.hora}`;
    if (localStorage.getItem(k2)) return;
    localStorage.setItem(k2, "1");
    localStorage.setItem(k, String(linha.hora));
    const texto = textoResultadoHora(canal, linha.hora, linha.real, linha.meta);
    onResultado(texto);
    disparar(texto);
  }, [canal, canalTela, dia, linha, horaAtual, onResultado, visivel, fala]);

  const alternar = async () => {
    if (som && pronto) {
      setSom(false);
      localStorage.setItem(KEY_SOM, "0");
      pararAudio();
      setFalando(false);
      return;
    }
    setSom(true);
    localStorage.setItem(KEY_SOM, "1");
    const ok = await ativarAudio();
    setPronto(ok);
    setErroSom(!ok);
  };

  const simular = () => {
    const meta = linha?.meta ?? 1000;
    const real = Math.round(meta * 1.06);
    const texto = textoResultadoHora(canal, horaAtual, real, meta);
    onResultado(texto);
    disparar(texto);
  };

  return (
    <>
      <Button variant="secondary" onClick={simular} disabled={!!fala} aria-label="Simular meta batida">🎉 Simular</Button>
      <Button variant={som && !pronto ? "outline" : "secondary"} onClick={() => void alternar()} disabled={!!fala}
        aria-label={som && pronto ? "Desligar som" : "Ligar som"} aria-pressed={som && pronto}
        title={erroSom ? "Som bloqueado: ative novamente na TV" : som && pronto ? "Desligar som" : "Ativar áudio nesta TV"}>
        {som && pronto ? "🔔" : "🔕"}{som && !pronto ? " Ativar som" : ""}
      </Button>
      {erroSom && <span role="alert" className="text-sm text-warning">Som bloqueado na TV</span>}
      {fala && <RaposaGigante fala={fala.n} texto={fala.texto} falando={falando} onFim={() => { setFala(null); pararAudio(); cancelarFogos.current?.(); }} />}
    </>
  );
}
