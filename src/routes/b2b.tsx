import { createFileRoute } from "@tanstack/react-router";
import { PainelProdutividade } from "@/components/PainelProdutividade";

export const Route = createFileRoute("/b2b")({
  head: () => ({
    meta: [
      { title: "Produtividade B2B hora a hora | Luft FTD" },
      { name: "description", content: "Painel B2B: metas por hora, peças e pedidos na caixa, forecast e atingimento." },
      { property: "og:title", content: "Produtividade B2B hora a hora | Luft FTD" },
      { property: "og:description", content: "Painel B2B: metas por hora, peças e pedidos na caixa, forecast e atingimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PainelProdutividade canal="B2B" />,
});
