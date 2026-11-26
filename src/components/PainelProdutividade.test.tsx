import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const estado = vi.hoisted(() => ({ pathname: "/", navigate: vi.fn(), b2cReal: 100 }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => estado.navigate,
  useLocation: ({ select }: { select: (l: { pathname: string }) => string }) => select({ pathname: estado.pathname }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/b2c.functions", () => ({ fetchResumoB2B: vi.fn(), fetchResumoB2C: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: { forecastDia: 1400, realPorHora: { 10: queryKey[0] === "resumo-b2c" ? estado.b2cReal : 100 }, caixa: { pecas: 1000, pedidos: 10 }, atualizadoEm: "2026-11-24T11:00:00" },
    isError: false,
  }),
}));
import { PainelProdutividade } from "./PainelProdutividade";

describe("comemoração no canal visível e rotação", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 24, 11, 0));
    localStorage.clear();
    localStorage.setItem("painel-rotacao", JSON.stringify({ seg: 5, pausado: false }));
    estado.pathname = "/";
    estado.b2cReal = 100;
    estado.navigate.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it("mantém B2C na tela pelos 20 segundos e depois retoma a rotação", async () => {
    render(<PainelProdutividade canal="B2C" />);
    expect(screen.getByLabelText("Raposa comemorando a meta batida")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(19_999); });
    expect(estado.navigate).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByLabelText("Raposa comemorando a meta batida")).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(estado.navigate).toHaveBeenCalledWith({ to: "/b2b" });
  });

  it("não comemora o resultado B2B enquanto B2C está na tela", () => {
    estado.b2cReal = 99;
    render(<PainelProdutividade canal="B2C" />);
    expect(screen.queryByLabelText("Raposa comemorando a meta batida")).not.toBeInTheDocument();
    expect(localStorage.getItem("comemorado:B2B:2026-11-24:10")).toBeNull();
  });

  it("comemora B2B quando B2B está na tela, sem trocar para B2C durante os 20 segundos", async () => {
    estado.pathname = "/b2b";
    render(<PainelProdutividade canal="B2B" />);
    expect(screen.getByLabelText("Raposa comemorando a meta batida")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(19_999); });
    expect(estado.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem("comemorado:B2B:2026-11-24:10")).toBe("1");
  });
});