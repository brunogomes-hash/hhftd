import { createServerFn } from "@tanstack/react-start";
import { parseCsv, parseForecast } from "./logistics";
import { resumoB2B, resumoB2C, type ResumoCanal } from "./resumo";

/** Planilha Senior do dash: aba "base geral" (gid) + aba "forecast". */
const SHEET_ID = "125avr9dVFXanFd64AESlCNyH2E61Sd4K91dk-8lP2y4";
const BASE_GID = "464975873";
/** Aba "Conf entrada + Sep + Rebin + Packing - FTD": peças por usuário/hora. */
const PROD_GID = "528693114";
const CACHE_MS = 2 * 60 * 1000;
let cache: { at: number; csv: string; forecast: string } | null = null;
let cacheProd: { at: number; csv: string } | null = null;

async function get(url: string) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Não foi possível ler a planilha (${res.status}).`);
  const text = new TextDecoder("utf-8").decode(await res.arrayBuffer());
  if (text.trimStart().startsWith("<")) throw new Error('A planilha não está pública ("Qualquer pessoa com o link").');
  return text;
}

export const fetchResumoB2C = createServerFn({ method: "GET" })
  .inputValidator((d: { dia: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dia)) throw new Error("Data inválida.");
    return d;
  })
  .handler(async ({ data }): Promise<ResumoCanal> => {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
      const [csv, forecast] = await Promise.all([
        get(`${base}/export?format=csv&gid=${BASE_GID}`),
        get(`${base}/gviz/tq?tqx=out:csv&sheet=forecast`).catch(() => ""),
      ]);
      cache = { at: Date.now(), csv, forecast };
    }
    const rows = parseCsv(cache.csv);
    const fc = cache.forecast ? parseForecast(cache.forecast, Number(data.dia.slice(0, 4))) : {};
    return resumoB2C(rows, fc, data.dia);
  });

function csvSimples(t: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}

export const fetchResumoB2B = createServerFn({ method: "GET" })
  .inputValidator((d: { dia: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dia)) throw new Error("Data inválida.");
    return d;
  })
  .handler(async ({ data }): Promise<ResumoCanal> => {
    const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      const [csv, forecast] = await Promise.all([
        get(`${base}/export?format=csv&gid=${BASE_GID}`),
        get(`${base}/gviz/tq?tqx=out:csv&sheet=forecast`).catch(() => ""),
      ]);
      cache = { at: Date.now(), csv, forecast };
    }
    if (!cacheProd || Date.now() - cacheProd.at > CACHE_MS) {
      cacheProd = { at: Date.now(), csv: await get(`${base}/export?format=csv&gid=${PROD_GID}`) };
    }
    const fc = cache.forecast ? parseForecast(cache.forecast, Number(data.dia.slice(0, 4))) : {};
    return resumoB2B(csvSimples(cacheProd.csv), parseCsv(cache.csv), fc, data.dia);
  });
