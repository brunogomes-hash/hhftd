import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import felizAnim from "@/assets/raposa-feliz-luft2.webp.asset.json";
import { DURACAO_COMEMORACAO } from "@/lib/comemoracao";

/**
 * Raposa em tamanho gigante no meio da tela, narrando a fala da hora batida.
 * Renderizada em portal para escapar da escala do painel.
 */
export function RaposaGigante({ fala, texto, falando, onFim }: { fala: number; texto: string; falando: boolean; onFim: () => void }) {
  const aoFim = useRef(onFim);
  aoFim.current = onFim;

  useEffect(() => {
    const t = setTimeout(() => aoFim.current(), DURACAO_COMEMORACAO);
    return () => clearTimeout(t);
  }, [fala]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-label="Raposa comemorando a meta batida"
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-3 bg-background/85 px-6 backdrop-blur-sm"
    >
      <div className="font-display text-[8vh] font-extrabold uppercase leading-none tracking-tight text-primary drop-shadow-[0_6px_28px_rgba(250,204,21,0.45)]">
        Meta batida!
      </div>
      <img
        src={felizAnim.url}
        alt="Raposa comemorando a meta batida"
        className="animate-raposa-entra h-[56vh] w-auto max-w-[80vw] object-contain"
      />
      <div className="flex items-center gap-4">
        {falando && (
          <span className="flex items-end gap-1" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="animate-raposa-fala w-[0.7vh] rounded-sm bg-primary"
                style={{ height: "3.2vh", animationDelay: `${i * 90}ms` }}
              />
            ))}
          </span>
        )}
        <span className="rounded-2xl border-2 border-primary bg-card px-6 py-2 text-center font-mono text-[2.4vh] font-bold uppercase text-primary">
          {texto}
        </span>
      </div>
    </div>,
    document.body,
  );
}
