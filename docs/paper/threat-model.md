# HealthSync — Threat Model (STRIDE)

Cited from the revised manuscript §V-C.1. This is a lightweight STRIDE model
covering the assets that leave the local host or cross a trust boundary. It
is not a substitute for third-party penetration testing — external testing
is scheduled for the multi-tenant provincial rollout (future work).

## 1. Assets

| Asset                     | Where                              | Sensitivity   |
|---------------------------|------------------------------------|---------------|
| Patient records           | PostgreSQL, host filesystem        | High (PHI)    |
| KYC ID + selfie images    | `uploads/kyc/` on host, transient  | High (biometric) |
| Session cookies           | Client browser, `express-session`  | High          |
| Audit log                 | PostgreSQL                         | Integrity-critical |
| SMS content               | Semaphore API + `sms_outbox` table | Medium        |
| LLM prompt payload        | HTTPS to OpenAI                    | See §5        |

## 2. Trust boundaries

1. **Client ↔ HealthSync server** — HTTPS terminated at the reverse proxy.
2. **HealthSync server ↔ PostgreSQL** — local socket or internal network.
3. **HealthSync server ↔ OpenAI (LLM)** — HTTPS to a third-party API.
4. **HealthSync server ↔ Semaphore (SMS)** — HTTPS to a third-party API.

## 3. STRIDE analysis

### 3.1 Spoofing

- **Threat:** attacker impersonates a valid user session.
- **Mitigation:** username/password authentication with `bcrypt` (salt cost
  10). Sessions are server-side (`connect-pg-simple`), 7-day TTL. Cookies
  are `httpOnly`, `secure` in production, and `sameSite=lax`. Failed logins
  are logged.
- **Residual risk:** credential stuffing. Rate-limit on `/auth/login` is
  recommended (`express-rate-limit`) — tracked as follow-up.

### 3.2 Tampering

- **Threat:** modification of records or audit trail.
- **Mitigation:** every mutating route runs Zod schema validation before
  write. Every write on high-value entities (users, KYC decisions, M1
  submissions) inserts a row in `audit_logs` with `before_json` / `after_json`.
  `audit_logs` has no update or delete endpoint.
- **Residual risk:** DB-level tampering by a compromised admin — mitigated
  by daily backups but not fully.

### 3.3 Repudiation

- **Threat:** a user denies performing an action.
- **Mitigation:** `audit_logs.user_id`, IP, and user-agent are captured on
  every write; admin-only routes require role check via `requireRole()`.

### 3.4 Information disclosure

- **Threat:** unauthorised read of another barangay's patients.
- **Mitigation:** the RBAC middleware (`server/middleware/rbac.ts`)
  automatically scopes queries by `assignedBarangays` for the `TL` role. The
  Playwright suite `tests/fp-rbac.spec.ts` exercises the barangay scoping.
- **Threat:** disclosure via LLM. See §5.

### 3.5 Denial of service

- **Threat:** brute-forcing login or the KYC endpoint to exhaust LLM quota.
- **Mitigation:** self-registration is behind an admin approval step, and
  KYC verdicts are cached on the record. Formal per-route rate-limits are a
  documented follow-up.

### 3.6 Elevation of privilege

- **Threat:** a `TL` user gains `MHO` or `SYSTEM_ADMIN` privileges.
- **Mitigation:** role is a column on `users`, not a self-serve field. Role
  changes require a `SYSTEM_ADMIN` action, which is audit-logged. The
  Playwright RBAC suite tries every role×route pair.

## 4. Data-privacy alignment

The threat model complements the DPA §20 measures in
`docs/paper/data-handling.md`.

## 5. LLM-specific threats

### 5.1 Prompt injection

- **Threat surface — narrative summary (`ai-insights.ts`):** the prompt is
  built from server-computed *aggregates and barangay names*. No free-text
  user input flows into the prompt, so classical prompt-injection has no
  channel.
- **Threat surface — KYC face-match (`kyc-face-match.ts`):** the prompt is a
  fixed system message plus two images. An attacker could embed adversarial
  text on the ID image itself (visual prompt injection); the mitigation is
  that the *verdict is advisory only* — the human admin is the final
  authority — and that the JSON schema is validated with a strict allow-list
  of verdicts (see `validVerdicts` in `kyc-face-match.ts`).

### 5.2 Data leakage

- Neither call site sends PHI. `ai-insights.ts` sends aggregates and public
  barangay names; `kyc-face-match.ts` sends images that are covered by the
  applicant's explicit consent.
- Model provider retention is ≤ 30 days for abuse-monitoring only; no
  training use.

### 5.3 Model hallucination

- The narrative in §V-A is presented labelled as "AI-generated" and always
  displayed alongside the underlying deterministic numbers.
- The KYC verdict is a hard-classified label from a four-element enum; if
  the model returns anything else, the code defaults to `INCONCLUSIVE` and
  forces manual review (`kyc-face-match.ts:141–143`).

## 6. Known gaps (tracked as follow-up)

- No external penetration test for this pilot; deferred to provincial rollout.
- No per-route rate limiting yet on `/auth/*`, `/kyc/*`. Planned:
  `express-rate-limit` with a leaky-bucket policy.
- No signed audit log — a highly privileged DB user could still alter
  `audit_logs`. Cryptographically-chained audit records are on the roadmap.
- Zero-retention LLM endpoint negotiation for the provincial rollout.
