import { isDiaUtil } from "./feriados";
export type Grupo = "B2B" | "B2C" | "PREF";
export type FilterCanal = "ALL" | "B2C" | "B2B" | "PREF";
export type Status = "Em fluxo" | "Em coleta" | "Em tratativa" | "Aguardando Expedição" | "Expedido";

export interface OrderRow {
  data?: string | undefined; // yyyy-mm-dd (integração)
  pedido: string;
  canal: string; // código original (FTD-RESI, FTD-ESCO, FTD-PREF, FTD-TRAN...)
  grupo: Grupo;
  status: Status;
  pecas: number;
  notaFiscal?: string | undefined;
  dataFaturamento?: string | undefined;
  dataExpedicao?: string | undefined;
  importadoEm?: string | undefined; // yyyy-mm-ddThh:mm (horário local)
  faturadoEm?: string | undefined;
  faturado?: boolean;
  /** Linha original da planilha (cabeçalho → valor), para exportação. */
  raw?: Record<string, string>;
}

/** month "yyyy-mm" -> forecast per group */
export type Forecast = Record<string, Partial<Record<Grupo, number>>>;

export const CHANNELS: { value: FilterCanal; label: string; title: string }[] = [
  { value: "ALL", label: "Geral (Todos)", title: "OUTBOUND GERAL" },
  { value: "B2C", label: "B2C (destinatário CPF)", title: "OUTBOUND B2C" },
  { value: "B2B", label: "B2B (CNPJ + Transferência)", title: "OUTBOUND B2B" },
  { value: "PREF", label: "Prefeitura (KM43)", title: "OUTBOUND PREFEITURA" },
];

/** Regra de canal: "KM43" no texto da classificação → Prefeitura; TRAN → B2B; demais: CNPJ → B2B, CPF → B2C.
 *  A tag antiga FTD-PREF não é mais usada pela operação. */
export function classify(codigo: string, documento: string): Grupo {
  const c = codigo.toUpperCase();
  if (c.includes("KM43")) return "PREF";
  if (c.includes("TRAN")) return "B2B";
  const digits = documento.replace(/\D/g, "");
  return digits.length === 11 ? "B2C" : "B2B";
}

export function matchesFilter(r: OrderRow, f: FilterCanal) {
  if (f === "ALL") return true;
  return r.grupo === f;
}

export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function addDays(s: string, n: number) {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
export function ddmm(s: string) {
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
}
/** Período padrão ao abrir o painel: mês corrente até hoje (horário de Brasília). */
export function currentMonthRange(now: Date = new Date(Date.now() - 3 * 3600e3)) {
  const today = now.toISOString().slice(0, 10);
  return { from: today.slice(0, 8) + "01", to: today };
}

/* ---------- CSV ---------- */
/** A planilha guarda textos UTF-8 lidos como Latin-1 ("ClassificaÃ§Ã£o"); corrige. */
export function fixMojibake(s: string) {
  if (!/Ã[\u0080-\u00ff]|Â[\u0080-\u00ff]/.test(s)) return s;
  try {
    const bytes = new Uint8Array([...s].map((ch) => ch.charCodeAt(0) & 0xff));
    const out = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return out;
  } catch {
    return s;
  }
}

function parseCsvText(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "");
  const firstLine = t.slice(0, t.indexOf("\n") >>> 0);
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur.trim()); cur = ""; }
    else if (c === "\n") { row.push(cur.trim()); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
  return rows.filter((r) => r.some((x) => x)).map((r) => r.map(fixMojibake));
}

function normKey(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function parseDateTime(v: string | undefined): string | undefined {
  const d = parseDate(v);
  if (!d) return undefined;
  const m = v!.match(/(\d{1,2}):(\d{2})/);
  return `${d}T${m ? m[1]!.padStart(2, "0") + ":" + m[2] : "00:00"}`;
}

/** Jornada: segunda a sábado, 06:00–22:00. */
export const JORNADA = { inicio: 6, fim: 22 };
/** Horas úteis entre dois instantes "yyyy-mm-ddThh:mm" (domingo não conta). */
export function horasUteis(a: string, b: string): number {
  const ta = Date.parse(a + ":00Z"), tb = Date.parse(b + ":00Z");
  if (!(tb > ta)) return 0;
  let total = 0;
  const day = new Date(a.slice(0, 10) + "T00:00:00Z");
  while (day.getTime() <= tb) {
    if (isDiaUtil(day.toISOString())) {
      const s = day.getTime() + JORNADA.inicio * 3600e3, e = day.getTime() + JORNADA.fim * 3600e3;
      total += Math.max(0, Math.min(e, tb) - Math.max(s, ta));
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return total / 3600e3;
}
export const SLA_HORAS = 48;
export const SLA_HORAS_RECEBIMENTO = 24;

export function parseDate(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return undefined;
}

/** Status da Nota Fiscal → status no painel (tabela do cliente). Produzido = faturado. */
export function produzidoOuExpedido(v: string) {
  const s = normKey(v);
  return s.includes("expedido") || s.includes("processado") || s === "faturado" ||
    s.includes("enviadoparafaturamento") || s.includes("conferenciaconcluida");
}
function normStatus(v: string, retencao: string): Status {
  const s = normKey(v);
  if (s.includes("expedido") || s.includes("processado")) return "Expedido";
  if (s === "faturado") return "Em coleta";
  if (s.includes("enviadoparafaturamento") || s.includes("conferenciaconcluida")) return "Aguardando Expedição";
  const r = normKey(retencao);
  if (r && !r.startsWith("sem")) return "Em tratativa";
  return "Em fluxo"; // importado, separação concluída, conferência iniciada...
}

type Col =
  | "data" | "pedido" | "canal" | "documento" | "status" | "retencao" | "pecas" | "notaFiscal"
  | "dataFaturamento" | "dataExpedicao" | "tipoDoc" | "conferidoEm" | "faturado" | "processado" | "canceladoEm" | "destinatario";
const ALIASES: Record<Col, string[]> = {
  data: ["importadoem", "cadastradaem", "dataimportacaocadastro", "data", "dataintegracao"],
  pedido: ["pedidodevenda", "pedido", "numeropedido"],
  canal: ["classificacaotipopedido", "codigodaclassificacao", "canal", "tipopedido"],
  documento: ["cnpjcpfdodestinatario", "cpfcnpj", "documento", "cnpjcpf"],
  destinatario: ["nomedodestinatario", "destinatario", "razaosocial", "cliente"],
  status: ["statusdanotafiscal", "status", "situacao"],
  retencao: ["statusretencao"],
  pecas: ["qtdetotaldeproduto", "pecas", "qtdpecas", "quantidade"],
  notaFiscal: ["notafiscal", "nf"],
  dataFaturamento: ["conferidoem", "faturadoem", "datafaturamento"],
  dataExpedicao: ["coletadoem", "processadoem", "dataexpedicao"],
  tipoDoc: ["tipododocumento"],
  conferidoEm: ["conferidoem"],
  faturado: ["faturado"],
  processado: ["processado"],
  canceladoEm: ["canceladoem"],
};

/** Destinatários que não entram na base nem no painel (nomes normalizados, sem acentos/espaços). */
export const EXCLUIDOS = ["ecoprimos", "santosbrasil"];

export function parseCsv(text: string): OrderRow[] {
  const lines = parseCsvText(text);
  if (lines.length < 2) throw new Error("Arquivo vazio ou sem linhas de dados.");
  const header = lines[0]!.map(normKey);
  const idx = {} as Record<Col, number[]>;
  for (const k of Object.keys(ALIASES) as Col[])
    idx[k] = ALIASES[k].map((a) => header.indexOf(a)).filter((i) => i >= 0);
  for (const req of ["status", "pecas"] as Col[])
    if (!idx[req].length) throw new Error(`Coluna obrigatória não encontrada: ${req}`);
  const get = (c: string[], k: Col) => idx[k].map((i) => c[i] ?? "").find((v) => v && !v.startsWith("#")) ?? "";
  const getDate = (c: string[], k: Col) => idx[k].map((i) => parseDate(c[i])).find(Boolean);
  const rows: OrderRow[] = [];
  lines.slice(1).forEach((c, i) => {
    const statusRaw = get(c, "status");
    if (normKey(statusRaw).includes("cancelad") || get(c, "canceladoEm")) return;
    // Notas sem pedido de venda (tipo "N") não são pedidos de saída
    if (idx.tipoDoc.length && get(c, "tipoDoc").toUpperCase() === "N") return;
    // Destinatários excluídos do painel
    if (EXCLUIDOS.some((x) => normKey(get(c, "destinatario")).includes(x))) return;
    const canal = get(c, "canal").toUpperCase();
    const faturado = produzidoOuExpedido(statusRaw);
    rows.push({
      data: getDate(c, "data"),
      pedido: get(c, "pedido") || get(c, "notaFiscal") || String(i + 1),
      canal,
      grupo: classify(canal, get(c, "documento")),
      status: normStatus(statusRaw, get(c, "retencao")),
      faturado,
      importadoEm: idx.data.map((k) => parseDateTime(c[k])).find(Boolean),
      faturadoEm: idx.conferidoEm.map((k) => parseDateTime(c[k])).find(Boolean),
      pecas: Number(get(c, "pecas").replace(/\./g, "").replace(",", ".")) || 0,
      notaFiscal: get(c, "notaFiscal") || undefined,
      dataFaturamento: getDate(c, "dataFaturamento"),
      dataExpedicao: getDate(c, "dataExpedicao"),
      raw: Object.fromEntries(lines[0]!.map((h, j) => [h || `Coluna ${j + 1}`, c[j] ?? ""])),
    });
  });
  return dropOversizedNfs(rows);
}

/** Transferências (FTD-TRAN) com mais de 15.000 peças na mesma nota não entram no dash de saída.
 *  Demais notas ficam, mesmo acima do limite. */
export const NF_PEÇAS_MAX = 15000;

export function dropOversizedNfs(rows: OrderRow[], max: number = NF_PEÇAS_MAX): OrderRow[] {
  const tot = new Map<string, number>();
  for (const r of rows) {
    if (!r.notaFiscal) continue;
    tot.set(r.notaFiscal, (tot.get(r.notaFiscal) ?? 0) + r.pecas);
  }
  return rows.filter((r) => !r.notaFiscal || !r.canal.includes("TRAN") || (tot.get(r.notaFiscal) ?? 0) <= max);
}




const MESES: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

export function parseForecast(text: string, year: number): Forecast {
  const lines = parseCsvText(text);
  const header = lines[0] ?? [];
  const out: Forecast = {};
  lines.slice(1).forEach((l) => {
    const k = normKey(l[0] ?? "");
    const g: Grupo | null = k.startsWith("b2b") ? "B2B" : k.startsWith("b2c") ? "B2C" : k.startsWith("pref") ? "PREF" : null;
    if (!g) return;
    header.slice(1).forEach((h, j) => {
      const mm = MESES[normKey(h)];
      if (!mm) return;
      const key = `${year}-${mm}`;
      (out[key] ??= {})[g] = Number(String(l[j + 1] ?? "").replace(/\./g, "").replace(",", ".")) || 0;
    });
  });
  return out;
}

/** Forecast diário de um dia = forecast do mês / dias do mês, somado pelos grupos do filtro. */
export function dailyForecast(fc: Forecast, day: string, f: FilterCanal) {
  const month = day.slice(0, 7);
  const m = fc[month];
  if (!m) return 0;
  const groups: Grupo[] = f === "ALL" ? ["B2B", "B2C", "PREF"] : [f];
  const total = groups.reduce((a, g) => a + (m[g] ?? 0), 0);
  const [y, mo] = month.split("-").map(Number);
  const dim = new Date(Date.UTC(y!, mo!, 0)).getUTCDate();
  return total / dim;
}

/** Forecast total de um mês (sem somar outros meses). */
export function monthForecast(fc: Forecast, month: string, f: FilterCanal) {
  const m = fc[month];
  if (!m) return 0;
  const groups: Grupo[] = f === "ALL" ? ["B2B", "B2C", "PREF"] : [f];
  return groups.reduce((a, g) => a + (m[g] ?? 0), 0);
}

/* ---------- Aggregation ---------- */
export interface Filters {
  canal: FilterCanal;
  from: string;
  to: string;
}

/** Linhas que entram no SLA: faturadas (com data) ou pendentes já vencidas. */
export function slaRows(rows: OrderRow[], now: string) {
  return rows.filter((r) =>
    !!r.importadoEm && (
      (r.faturado && !!r.faturadoEm) ||
      (!r.faturado && horasUteis(r.importadoEm, now) > SLA_HORAS)
    ),
  );
}

/** Só as linhas fora do SLA: concluídas acima de 48 h úteis ou pendentes já vencidas. */
export function slaForaRows(rows: OrderRow[], now: string) {
  return slaRows(rows, now).filter(
    (r) => !(r.faturado && r.faturadoEm && horasUteis(r.importadoEm!, r.faturadoEm) <= SLA_HORAS),
  );
}

/** SLA: % de NFs faturadas em até 48 h úteis após "Importado em". Pendentes já vencidas contam como fora. */
export function slaPct(rows: OrderRow[], now: string) {
  const list = slaRows(rows, now);
  const ok = list.filter((r) => r.faturado && r.faturadoEm && horasUteis(r.importadoEm!, r.faturadoEm) <= SLA_HORAS).length;
  return list.length ? (ok / list.length) * 100 : 0;
}

function nowLocal() {
  const d = new Date(Date.now() - 3 * 3600e3); // horário de Brasília
  return d.toISOString().slice(0, 16);
}

export function computeOutbound(all: OrderRow[], f: Filters, fc: Forecast, now: string = nowLocal()) {
  // Linhas sem data legível entram nos KPIs, mas não nos gráficos por data.
  const rows = all.filter((r) => matchesFilter(r, f.canal) && (!r.data || (r.data >= f.from && r.data <= f.to)));
  const sum = (pred: (r: OrderRow) => boolean) => {
    const s = rows.filter(pred);
    return { pecas: s.reduce((a, r) => a + r.pecas, 0), pedidos: new Set(s.map((r) => r.notaFiscal ?? r.pedido)).size };
  };
  const integradas = sum(() => true);
  // Em fluxo: tudo que não foi faturado, processado nem expedido (canceladas já saem na leitura)
  const fluxo = sum((r) => !r.faturado);
  const coleta = sum((r) => r.status === "Em coleta");
  const tratativa = sum((r) => r.status === "Em tratativa");
  const produzidas = sum((r) => !!r.faturado);
  const expedidas = sum((r) => r.status === "Expedido");
  const isAg = (r: OrderRow) => r.status === "Aguardando Expedição";
  const agExp = sum(isAg);
  const noCd = sum((r) => !r.faturado || isAg(r));
  const lists = {
    agExp: rows.filter(isAg),
    noCd: rows.filter((r) => !r.faturado || isAg(r)),
    integradas: rows,
    fluxo: rows.filter((r) => !r.faturado),
    produzidas: rows.filter((r) => !!r.faturado),
    expedidas: rows.filter((r) => r.status === "Expedido"),
  };

  const days: string[] = [];
  for (let d = f.from; d <= f.to; d = addDays(d, 1)) days.push(d);
  // Forecast é por mês e não se soma entre meses: filtro de um mês usa o forecast dele;
  // período com mais de um mês usa o mês corrente (ou o último mês do período).
  const hojeM = now.slice(0, 7);
  const fromM = f.from.slice(0, 7), toM = f.to.slice(0, 7);
  const forecastMonth = fromM === toM ? fromM : hojeM >= fromM && hojeM <= toM ? hojeM : toM;
  const forecastTotal = monthForecast(fc, forecastMonth, f.canal);
  const idealAteAgora = idealIntegrado(forecastTotal, forecastMonth, now);

  const byDay = (key: (r: OrderRow) => string | undefined) => {
    const m = new Map<string, { pecas: number; nf: Set<string> }>();
    rows.forEach((r) => {
      const k = key(r);
      if (!k) return;
      const e = m.get(k) ?? { pecas: 0, nf: new Set<string>() };
      e.pecas += r.pecas;
      if (r.notaFiscal) e.nf.add(r.notaFiscal);
      m.set(k, e);
    });
    return m;
  };
  const integ = byDay((r) => r.data);
  const fat = byDay((r) => r.dataFaturamento);
  const exp = byDay((r) => r.dataExpedicao);

  // Gráficos por data: sempre todas as datas do mês corrente até hoje (dias sem dado = 0).
  // Se o período do filtro está todo fora do mês corrente (ex.: setembro), usa o período inteiro do filtro.
  const hoje = now.slice(0, 10);
  const mes1 = hoje.slice(0, 8) + "01";
  let chartStart = f.from > mes1 ? f.from : mes1;
  const chartEnd = f.to < hoje ? f.to : hoje;
  if (chartStart > chartEnd) chartStart = f.from;
  const chartDays: string[] = [];
  for (let d = chartStart; d <= chartEnd; d = addDays(d, 1)) chartDays.push(d);
  const integradasPorData = chartDays.map((d) => ({
    dia: ddmm(d), total: integ.get(d)?.pecas ?? 0, forecast: Math.round(dailyForecast(fc, d, f.canal)),
  }));
  const faturadosPorData = chartDays.map((d) => ({ dia: ddmm(d), quantidade: fat.get(d)?.pecas ?? 0, notas: fat.get(d)?.nf.size ?? 0 }));
  const expedidasPorData = chartDays.map((d) => ({ dia: ddmm(d), quantidade: exp.get(d)?.pecas ?? 0 }));

  const statusPorData = [...integ.keys()].sort().reverse().map((d) => {
    const dr = rows.filter((r) => r.data === d);
    const s = (p: (r: OrderRow) => boolean) => dr.filter(p).reduce((a, r) => a + r.pecas, 0);
    return {
      dia: ddmm(d),
      Expedido: s((r) => r.status === "Expedido"),
      "Em fluxo": s((r) => ["Em fluxo", "Em coleta", "Em tratativa"].includes(r.status)),
      "Ag. Exp.": s((r) => r.status === "Aguardando Expedição"),
    };
  });

  const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
  return {
    forecastTotal, idealAteAgora, integradas, fluxo, coleta, tratativa, produzidas, expedidas, agExp, noCd, lists,
    semData: rows.filter((r) => !r.data).length,
    // SLA considera apenas pedidos importados dentro do período do filtro (com data legível)
    sla: slaPct(rows.filter((r) => r.data), now),
    slaList: slaRows(rows.filter((r) => r.data), now),
    slaFora: slaForaRows(rows.filter((r) => r.data), now),
    integradoXFcst: pct(integradas.pecas, forecastTotal),
    produzidoXFcst: pct(produzidas.pecas, forecastTotal),
    integradasPorData, faturadosPorData, expedidasPorData, statusPorData,
  };
}

export const fmt = (n: number) => n.toLocaleString("pt-BR");
export const fmtPct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

/** Quanto deveria ter integrado até `now`: forecast do mês ÷ dias úteis (seg–sáb, sem feriados) ÷ 16h (06–22). */
export function idealIntegrado(forecast: number, month: string, now: string): number {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = now.slice(0, 10);
  const h = Number(now.slice(11, 13)) + Number(now.slice(14, 16)) / 60;
  let total = 0, done = 0;
  for (let d = 1; d <= last; d++) {
    if (!isDiaUtil(`${month}-${String(d).padStart(2, "0")}`)) continue;
    total += 16;
    const iso = `${month}-${String(d).padStart(2, "0")}`;
    if (iso < today) done += 16;
    else if (iso === today) done += Math.min(16, Math.max(0, h - 6));
  }
  return total ? Math.round((forecast * done) / total) : 0;
}
