import aplausos from "@/assets/aplausos-torcida.mp3.asset.json";
import f1 from "@/assets/raposa-fala-1.m4a.asset.json";
import f2 from "@/assets/raposa-fala-2.m4a.asset.json";
import f3 from "@/assets/raposa-fala-3.m4a.asset.json";
import f4 from "@/assets/raposa-fala-4.m4a.asset.json";
import f5 from "@/assets/raposa-fala-5.m4a.asset.json";
import f6 from "@/assets/raposa-fala-6.m4a.asset.json";
import { DURACAO_COMEMORACAO } from "./comemoracao";

const FALAS = [f1.url, f2.url, f3.url, f4.url, f5.url, f6.url];
let player: HTMLAudioElement | undefined;
let liberado = false;
let liberacao: Promise<boolean> | undefined;
let sequencia = 0;
const timers: ReturnType<typeof setTimeout>[] = [];
// Files are cached in memory so switching voice/applause starts instantly (no network wait).
const cache = new Map<string, string>();

function local(url: string) { return cache.get(url) ?? url; }

export function precarregarAudios() {
  if (typeof fetch === "undefined" || typeof URL.createObjectURL !== "function") return;
  for (const url of [aplausos.url, ...FALAS]) {
    if (cache.has(url)) continue;
    cache.set(url, url);
    void fetch(url).then((r) => r.blob()).then((b) => cache.set(url, URL.createObjectURL(b))).catch(() => cache.delete(url));
  }
}

function audio() {
  // Reuse the gesture-authorized element across channel changes and all phases.
  if (!player) {
    player = new Audio(aplausos.url);
    player.preload = "auto";
  }
  return player;
}

export function audioLiberado() { return liberado; }

export function ativarAudio(): Promise<boolean> {
  if (liberacao) return liberacao;
  precarregarAudios();
  const el = audio();
  el.volume = 0.8;
  const atual = sequencia;
  liberacao = el.play().then(() => {
    liberado = true;
    timers.push(setTimeout(() => {
      if (atual === sequencia) { el.pause(); el.currentTime = 0; }
    }, 150));
    return true;
  }).catch(() => {
    liberado = false;
    return false;
  }).finally(() => { liberacao = undefined; });
  return liberacao;
}

export function pararAudio() {
  sequencia += 1;
  for (const t of timers) clearTimeout(t);
  timers.length = 0;
  if (player) { player.pause(); player.onended = null; }
}

/** The fox's voice starts together with the overlay; applause follows the voice until 20 s. */
export function tocarComemoracao(fala: number, onFalando: (v: boolean) => void, onErro: () => void) {
  pararAudio();
  const atual = sequencia;
  const el = audio();
  const tocar = (url: string, voz: boolean) => {
    if (atual !== sequencia) return;
    el.pause();
    el.src = local(url);
    el.currentTime = 0;
    el.volume = voz ? 1 : 0.8;
    el.loop = !voz;
    el.onended = voz ? () => { onFalando(false); tocar(aplausos.url, false); } : null;
    onFalando(voz);
    void el.play().catch(() => {
      if (atual !== sequencia) return;
      liberado = false;
      pararAudio();
      onFalando(false);
      onErro();
    });
  };
  tocar(FALAS[fala] ?? f1.url, true);
  timers.push(setTimeout(() => { pararAudio(); onFalando(false); }, DURACAO_COMEMORACAO));
  return pararAudio;
}
