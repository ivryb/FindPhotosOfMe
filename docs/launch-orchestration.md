# FindPhotosOfMe launch work

Updated 2 October 2026. This thread coordinates the landing-page exploration and hosting decisions. Current priority: choose a clear visual direction and turn it into a complete organizer offering. Convex and R2 stay. Ivan's preference to investigate leaving Vercel and Google Cloud supersedes the earlier keep-current-hosts recommendation in `portfolio-launch.md`; no hosting choice or production cutover has yet been approved.

## Review package

- [Landing-page brief](landing-page-brief.md): positioning, copy library, section sequence, audiences, typography, three visual directions, and a later dashboard brief.
- [Design comparison](../design/landing/index.html): three local Claude Code prototypes, each isolated from the application. Run `python3 -m http.server 4318 --bind 127.0.0.1 --directory design/landing` from the repository root and open `http://127.0.0.1:4318/`.
- [Python hosting options](python-hosting-options.md): seven-provider comparison with workload assumptions and source-backed prices. Shortlist Railway and Modal; consider Cloudflare Containers if provider consolidation is more valuable than the extra integration work.
- [Cloudflare assessment](cloudflare-migration-assessment.md): Nuxt/Workers compatibility, Telegram lifecycle changes, preview hostnames, costs, and a staged plan.

The landing concepts are design previews. They do not create accounts, upload personal photos, run face recognition, or accept payments. Prices and retention periods in the earlier portfolio note remain hypotheses. Existing application changes were already present before this exploration.

## Recommended sequence

| Step | Concrete outcome | Decision or dependency |
| --- | --- | --- |
| Choose the landing direction | One visual identity and final page outline | Ivan reviews the three concepts; combine specific strengths if useful |
| Implement the chosen page | Responsive Nuxt landing page with real, appropriate CTA routes | Decide whether the first public offering is early access or validated self-service |
| Resolve model rights | Documented commercial rights and known license cost, or an evaluated replacement | Current `buffalo_l` weights need separate commercial licensing; changing models also requires re-indexing and accuracy checks |
| Prepare Python migration | Measured startup, memory, ingest and search behavior on an agreed candidate | Reuse existing Convex jobs; agree the execution boundary before adding infrastructure |
| Port the web app locally | Actual Workers build and complete local/test journey | Telegram continuation, dependency ownership, hostname handling and R2 compatibility need work |
| Polish the organizer dashboard | A clear create/upload/prepare/share journey in the selected visual style | Reuse the existing domain model; avoid speculative teams, subscriptions and analytics |
| Finish the commercial offering | Validated event limits, retention, support, policies, pricing and test checkout | Infrastructure and license costs; use only the dedicated FindPhotosOfMe Lemon Squeezy store |
| Stage and launch | Verified organizer and attendee journey, then controlled cutover | External staging/production changes require explicit approval; keep rollback until verified |

Landing implementation can proceed independently of hosting trials. Do not combine two provider migrations and a dashboard redesign into one release.

## Findings to carry into implementation

The research exposed two concrete access-control gaps in the current uncommitted application: the private-image signing endpoint ignores a false authorization result, and the Telegram webhook does not verify a webhook secret. These were documented, not changed by the design/research work. Correct and verify them before public launch.

Python currently reloads the model per request, buffers large ZIP files in memory, and performs blocking inference inside async request handlers. A different provider does not itself fix those behaviors. Establish a measured baseline before comparing hosting prices or publishing speed claims.

Browser search currently requires sign-in. All public copy must reflect that. Sports events are a useful pilot audience, with representative action-photo testing required before performance claims. The founder's IT Arena use is the available origin story, not permission to display an endorsement or invented metrics.

## Evidence limits

Research used current local source and official provider documentation. No current Cloud Run metrics or new invoice were obtained; a read-only service listing lacked permission. No Cloudflare administration tools were exposed in this session. No deployment, DNS change, provider purchase, customer message, or payment-provider mutation was performed.
