# Where I left off — May 2026 session

A bookmark for picking the project back up. Written by Claude at the user's
request after the May 5-6 ship cadence + deployment-staleness QA pass.

---

## What's already shipped (PRs in `main` but possibly stale on the deployed app)

| PR | What it does | Status |
|---|---|---|
| #195-#202 | `<Term>` glossary sprinkle across maternal, child, NCD, TB/PIDSR/Outbreaks, Mortality, Inventory, Walk-in/Konsulta, AEFI/IMCI surfaces. Click any underlined acronym → DOH-cited popup. | Merged |
| #203 | `<Term>` sprinkle on `client/src/pages/m1-report.tsx` (FHSIS, M1, TL). Closes the glossary initiative — every operator-facing page has at least one inline definition. | Merged |
| #204 | Daily Caraga DOH news scraper. `server/scheduler/scrape-caraga-doh.ts` runs at 6 AM Manila; admin trigger at `POST /api/admin/scrape-doh-updates`. Adds `source` column to `doh_updates`. | Merged |
| #205 | AI recommendations Phase 1 — rule engine + 7 rules across 5 disease modules (rabies x2, filariasis x2, schisto, sth, leprosy). `shared/recommendations.ts` + `<RecommendationCard>`. Cards render in the surveillance action drawer. | Merged |
| #206 | `RECOMMENDATION_SHOWN` / `RECOMMENDATION_ACTED` audit logging via `POST /api/recommendations/log`. | Merged |
| #207 | AI recs Phase 2 — cluster hint banner (rabies Cat III ≥3 in 7 days) + plain-language LLM toggle (OpenAI, in-process cache). | Merged |
| #208 | Calibration view at `/admin/recommendations` — aggregates SHOWN/ACTED by ruleId, conversion %, severity badge, DOH source. SYSTEM_ADMIN + MHO. | Merged |

---

## Active blocker — deployment is stale

QA on the deployed app showed `dist/index.cjs` is from **May 3 18:28**, but PRs #197-#208 merged **May 5-6**. Source is correct; the served bundle is not. The Replit Deployments pipeline didn't actually run `npm run build`.

**Fix when you come back:**

```bash
# In the Replit workspace shell:
git pull origin main
rm -rf dist && npm run build
grep -c scrape-doh-updates dist/index.cjs              # expect ≥1
grep -c "Recommendation calibration" dist/public/assets/*.js   # expect ≥1
# Then in Replit UI: Deployments tab → Redeploy
```

**Hardening idea (not yet shipped):** add `npm run build` to `scripts/post-merge.sh` so every workspace pull also rebuilds `dist/`. Currently the post-merge hook only runs `npm install` + `npm run db:push`.

---

## Re-run QA after redeploy

The corrected v2 QA prompt is in this session's transcript. Key fixes vs v1:
- Every "hover" → "click" (the `<Term>` component opens on click, NN/g popup-tip pattern, not hover)
- Step 13 has an explicit pre-flight: if `Content-Type: text/html` on the scraper POST, the build is stale → halt before running the rest.

---

## Deferred follow-ups (small, ready when you are)

1. **Cluster hint for other modules** — currently rabies-only. Schisto and STH could share a same-barangay-window predicate; leprosy is contact-tracing (different model); filariasis has multi-year latency (a 7-day window doesn't fit). Honest take: only schisto + STH have clean predicate fits.
2. **Draft referral letter generator** — bigger build. Needs template fields, edit/save flow, per-disease wording. Mentioned in `docs/ai-recommendations-design.md` Phase 2 but explicitly deferred.
3. **Cluster hint in source citation** — link the source URL to the actual DOH PDF on the regional site.
4. **Doc refresh** — `docs/system-architecture.md` and `docs/m1-data-source-audit.md` are stale on the AI recs engine + DOH scraper.

---

## Bigger decisions on the table

### Off-Replit migration

You asked about moving off Replit. Two real options for **free** hosting that still works for this app:

- **Render free** ($0): simplest, but spins down after 15 min idle (cold start on first hit) and the in-process scheduler won't run when the service is asleep. Free Postgres expires after 90 days. Good for thesis demos / portfolio.
- **Fly.io free** ($0 within limits, credit card required on file): always-on, scheduler works, ~half-day setup (Dockerfile + flyctl). Good for "this needs to actually run."

Costs ~$14/mo on Render's smallest paid tier (Web Starter $7 + Postgres Starter $7) if you want always-on without Fly's Dockerfile setup.

**The one real migration cost:** Replit Auth (`javascript_log_in_with_replit:2.0.0` per `.replit:[agent].integrations`) won't work outside Replit. The `users` table has `passwordHash` already, so swapping to passport-local is straightforward (~1 day). Or use Clerk / Auth0 (managed, ~hours, small monthly cost).

**Django rewrite** — possible but it's a 2-3 month rewrite, not a migration. Only justified if you specifically want Python ecosystem or Django Admin. The deployment pain is solvable without rewriting anything.

### Learning to code

You asked where to start. Concrete path:

1. Install **VS Code** (free, https://code.visualstudio.com)
2. Install extensions: ESLint, Prettier, Tailwind CSS IntelliSense, GitLens, Claude Code
3. Learning curriculum (free, ordered by relevance to this project):
   - **The Odin Project** — Full Stack JavaScript path
   - **freeCodeCamp** — Front End Libraries cert (covers React)
   - **CS50x (Harvard)** — best general programming intro
   - **MDN Web Docs** — THE reference, bookmark it
4. Local clone command:
   ```bash
   git clone https://github.com/youredone4/Unified-Health-Sync.git
   cd Unified-Health-Sync
   npm install
   code .
   ```
5. Then ask Claude (in VS Code via the Claude Code extension) to walk you through any file you don't understand — that's faster than generic tutorials for learning THIS codebase.

---

## Open questions for next time

- Are you moving off Replit or staying? (Drives whether to ship Render/Fly setup vs. the post-merge.sh hardening fix.)
- Is this project for a real clinic or for a thesis defense? (Drives whether always-on matters or if Render free's spin-down is acceptable.)
- Want to tackle the deferred follow-ups (cluster hint for schisto/STH, draft referral letter) or move to a different track?
