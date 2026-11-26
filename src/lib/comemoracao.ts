import { horaAnterior, type HoraLinha } from "./produtividade";

/** A hora só comemora quando bate 100% da meta (ou passa dela). */
export const META_PARA_COMEMORAR = 1;

/** Only the immediately preceding, fully closed hour can celebrate. */
export function podeComemorarHora(linha: HoraLinha | undefined, horaAtual: number) {
  return !!linha && !linha.atual && linha.hora === horaAnterior(horaAtual) && linha.meta > 0 && linha.real / linha.meta >= META_PARA_COMEMORAR;
}

/** The winning channel must be the one currently visible on the TV. */
export function podeComemorarNaTela(linha: HoraLinha | undefined, horaAtual: number, canal: string, canalTela: string, visivel: boolean) {
  return visivel && canal === canalTela && podeComemorarHora(linha, horaAtual);
}

/** A comemoração (fogos + raposa narrando) dura pelo menos 20 segundos. */
export const DURACAO_COMEMORACAO = 20_000;

/** Quantas gravações a raposa tem para narrar. */
export const TOTAL_FALAS = 6;

const KEY_FALAS = "painel-falas";

/** A cada hora batida a raposa usa uma gravação diferente, girando as 6 em ordem. */
export function proximaFala() {
  const atual = Number(localStorage.getItem(KEY_FALAS)) || 0;
  localStorage.setItem(KEY_FALAS, String((atual + 1) % TOTAL_FALAS));
  return atual % TOTAL_FALAS;
}

export function textoResultadoHora(canal: string, hora: number, real: number, meta: number) {
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const pct = meta > 0 ? (real / meta * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0";
  return `${canal} · ${hh(hora)}–${hh(hora + 1)} · DENTRO DA META · ${fmt(real)} / ${fmt(meta)} PEÇAS · ${pct}%`;
}