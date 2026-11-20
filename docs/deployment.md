# Deploying HealthSync

This guide is for whoever sets up and looks after the HealthSync server for
the LGU. It assumes you can use a Linux command line. You do not need to
know the codebase.

HealthSync runs as three Docker containers:

| Container | What it does | Reachable from outside? |
|---|---|---|
| `caddy` | HTTPS front door; gets and renews the certificate | Yes, ports 80 and 443 |
| `app` | The HealthSync web app and API | No |
| `db` | PostgreSQL 16 database | No |

## Before real patient data

**Do not enter real patient records until every box below is ticked.**

Done in the software:

- [x] No built-in accounts. The first administrator is created on the
      server; accounts still on an old default password are refused.
- [x] Every API endpoint requires a login unless explicitly listed as public.
- [x] Barangay restrictions enforced on every record a nurse can open or edit.
- [x] No patient data in the server logs.
- [x] Login protection: rate limiting, account lockout, idle and daily
      session limits, forced password change for new and reset accounts.
- [x] No public self-registration and no ID-photo uploads.

Still open:

- [ ] Automated, encrypted backups and a tested restore.
- [ ] Two-factor login for administrators.
- [ ] Data Privacy Act paperwork (see [Data privacy](#data-privacy)).
- [ ] An independent security review / penetration test before go-live.
      The built-in checks (`npm run test:security`) cover the known cases;
      they are not a substitute for someone trying to break in.

Until then, run with demo data only (`SEED_DEMO_DATA=true`).

## What you need

- A Linux server (Ubuntu 22.04 or 24.04 recommended), 2 CPU cores, 4 GB RAM,
  40 GB disk. It can be a machine in the municipal office or a cloud VM.
- [Docker Engine](https://docs.docker.com/engine/install/) with the Compose
  plugin.
- An address for the system:
  - **Public:** a domain name (for example `healthsync.placer.gov.ph`) whose
    DNS points at the server, with ports 80 and 443 open.
  - **Office network only:** the server's fixed LAN IP address.

## First deployment

1. Get the code onto the server:

   ```bash
   git clone https://github.com/youredone4/Unified-Health-Sync.git healthsync
   cd healthsync
   ```

2. Create the configuration file:

   ```bash
   cp .env.example .env
   chmod 600 .env
   ```

   Edit `.env` and set:

   | Setting | Value |
   |---|---|
   | `SESSION_SECRET` | output of `openssl rand -hex 32` |
   | `POSTGRES_PASSWORD` | output of `openssl rand -hex 24` |
   | `SITE_ADDRESS` | your domain, or `https://<server LAN IP>` |

   `.env` contains secrets. Never commit it, email it, or paste it into chat.

3. Office network only: open `Caddyfile` and remove the `#` in front of
   `tls internal`. See [HTTPS on an office network](#https-on-an-office-network).

4. Start everything:

   ```bash
   docker compose up -d --build
   ```

   The first build takes a few minutes. The app creates its database tables
   automatically on first start.

5. Check that it is healthy:

   ```bash
   docker compose ps                 # all three should be "running" / "healthy"
   docker compose logs -f app        # Ctrl+C to stop watching
   ```

6. Create the first administrator. There are no built-in accounts:

   ```bash
   docker compose exec app node dist/admin.cjs create-admin <username>
   ```

   This prints a temporary password **once**. Open your `SITE_ADDRESS` in a
   browser, sign in with it, and you will be asked to choose your own
   password straight away. Create everyone else's account from
   **Admin → Users** inside the app.

## Moving your data from Replit

Skip this section for a fresh, empty system.

1. **On Replit**, open the Shell and export the database:

   ```bash
   pg_dump "$DATABASE_URL" --no-owner --no-privileges -Fc -f healthsync.dump
   ```

   Download `healthsync.dump` and copy it to the server, into the
   `healthsync` folder. This file contains everything in the database —
   treat it like the database itself and delete stray copies afterwards.

2. **On the server**, start only the database and load the dump into it.
   Do this *before* the app has ever started against this database:

   ```bash
   docker compose up -d db
   docker compose exec -T db sh -c \
     'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
     < healthsync.dump
   ```

3. Tell the migration system that these tables already exist (once only):

   ```bash
   docker compose run --rm app node dist/migrate.cjs --baseline
   ```

4. Start the rest:

   ```bash
   docker compose up -d
   ```

5. Reset the old passwords. The Replit version shipped with public default
   passwords (`admin123`, `123456`). Any account still using one is refused
   at login, by design. Recover the administrator from the server:

   ```bash
   docker compose exec app node dist/admin.cjs reset-password admin
   ```

   Sign in with the temporary password it prints, then use
   **Admin → Users → Reset PW** to give each nurse a new temporary password.
   Everyone chooses their own password at their next login.

If you already started the app on an empty database and want to start over,
`docker compose down -v` deletes **all** data volumes; then begin again at
step 2.

## HTTPS on an office network

A public certificate authority cannot issue a certificate for a private IP
address. With `tls internal`, Caddy creates its own certificate authority
instead. Browsers will warn until each office computer trusts it:

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./healthsync-root.crt
```

Install `healthsync-root.crt` as a trusted root certificate on each computer
that uses HealthSync (on Windows: double-click → Install Certificate → Local
Machine → Trusted Root Certification Authorities).

## Day-to-day operations

**Update to a new version**

```bash
git pull
docker compose up -d --build
```

Database changes are applied automatically at startup. If a migration fails,
the app container stops rather than run against a half-updated database;
`docker compose logs app` shows why.

**Back up the database**

```bash
mkdir -p backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
  > "backups/healthsync-$(date +%F).dump"
```

Keep backups off the server and encrypted — they contain patient data. A
backup is only real once you have restored it somewhere and checked it.

**Restore a backup** (replaces current data)

```bash
docker compose stop app
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < backups/healthsync-2026-01-31.dump
docker compose start app
```

**Logs**

```bash
docker compose logs --since 1h app
```

**Stop / start**

```bash
docker compose stop
docker compose start
```

## Accounts and passwords

- **Creating accounts.** Only a System Admin can create accounts
  (**Admin → Users**). The password they type is temporary; the new user
  must replace it at first login.
- **Forgotten password.** A System Admin resets it from **Admin → Users**.
  The user is signed out everywhere and must choose a new password.
- **Locked out.** Five wrong passwords lock an account for 15 minutes. An
  admin password reset clears the lock immediately.
- **The administrator is locked out or forgot their password.** From the
  server:

  ```bash
  docker compose exec app node dist/admin.cjs reset-password <username>
  docker compose exec app node dist/admin.cjs list      # who exists, who is locked
  ```

- **Someone leaves.** Disable the account in **Admin → Users**. They are
  signed out immediately; their past entries stay attributed to them.
- **Sessions.** People are signed out after 60 minutes without activity
  and at most 12 hours after signing in. Both are adjustable in `.env`
  (`SESSION_IDLE_MINUTES`, `SESSION_MAX_HOURS`).
- **Password rules.** At least 12 characters, not a common password, not
  the person's own name or username.

Every sign-in, failed sign-in, lockout and password reset is recorded in
**Admin → Audit Logs**.

## Optional services

All are off until their settings in `.env` are filled in.

| Service | Settings | Without it |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | AI insights use the built-in rule-based text; plain-language summaries are unavailable |
| Semaphore SMS | `SEMAPHORE_API_KEY`, `SEMAPHORE_SENDER_NAME` | SMS are recorded but not sent |
| PhilHealth Konsulta | `PHILHEALTH_API_*` | Submissions are disabled |

## Data privacy

HealthSync stores sensitive personal information under the Data Privacy Act
of 2012 (RA 10173). Software settings alone do not make the LGU compliant.
Before go-live the LGU should, with its legal office:

- Appoint a Data Protection Officer and register with the National Privacy
  Commission where required.
- Publish a privacy notice and define who may access which records.
- Decide retention periods and how records are disposed of.
- Have a breach response procedure (the NPC must be notified within 72 hours
  of a qualifying breach).

**OpenAI.** When `OPENAI_API_KEY` is set, the AI insights feature sends
municipality-level statistics (counts and percentages per barangay, disease
names) to OpenAI, and the plain-language feature sends the text of clinical
guideline rules. Neither sends patient names or individual records. The data
is processed outside the Philippines, so the LGU should cover this in its
privacy notice and have a data processing agreement in place, or leave the
key blank.
