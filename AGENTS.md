<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Hourly productivity rules (hour weights, in/out band, mock data) live in src/lib/produtividade.ts with tests; both channel pages share src/components/PainelProdutividade.tsx; why: B2B and B2C must apply identical rules and swapping mock data for the sheet touches one module.
- Panel renders at a fixed 1920x1080 canvas scaled to fit the window; why: TVs and small previews must always show the whole board, including the attainment card.
- B2C figures come from the public Senior sheet base tab + forecast tab; B2B hourly figures sum every user's PACKING rows typed B2B in the productivity tab (gid 528693114); both aggregated server-side in src/lib/b2c.functions.ts with a 2-minute cache, rules in src/lib/resumo.ts; why: the CSVs are large and TVs only need hourly totals.
- Celebration eligibility lives in src/lib/comemoracao.ts and receives the immediately preceding closed hour; why: live-hour attainment must never trigger the closing-hour alert.
- Celebration audio reuses one gesture-authorized HTMLAudioElement in src/lib/audio-comemoracao.ts across routes; why: TV browsers may block new or delayed audio elements, and playback failures must be surfaced.
- Presentation rotation is suspended while the visible channel celebrates; why: the 20-second overlay and audio must remain on the winning channel.
