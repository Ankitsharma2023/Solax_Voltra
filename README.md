# Voltra Energy app (SolaX Cloud)

Installable web app (PWA) for Voltra customers, installers and distributors, modelled on the SolaX Cloud app.
Live data comes from the SolaX Developer Portal OpenAPI; the SolaX key never leaves the server.

## Run locally
```bash
npm install
cp .env.example .env   # fill in the SolaX keys, MongoDB URI, VAPID keys, SESSION_SECRET
npm run dev            # backend on :4300 + app on http://localhost:5173
```
Production: `npm run build && npm start` (the server serves `dist/` and the API on one port).

## Deploy (Render)
`render.yaml` defines one web service (API + app). Render → **New → Blueprint** → this repo, then fill in the
secret values (SolaX keys, `MONGODB_URI`, `SESSION_SECRET`, VAPID keys). Health check: `/api/health`.
Pushes to `main` redeploy automatically. MongoDB Atlas must allow `0.0.0.0/0` (Render has no fixed IPs on free).

## Storage
SolaX data is never stored — it's read live (with a short shared cache).
The app's own data lives in **MongoDB** (`MONGODB_URI`): `users`, `kv` (push subscriptions/state) and
`plant_settings` (tariff, TOU plan, automation scenes, work-mode draft per plant).
Without `MONGODB_URI` it falls back to JSON files in `data/` for local testing.
`npm run migrate` copies existing `data/` files into MongoDB (safe to re-run).

## Accounts
Identities as in SolaX sign-up: **End User**, **Installer**, **Distributor**, plus **Admin** (Voltra staff).
- End users prove ownership with the inverter SN + dongle registration number.
- Installers/distributors join under an Organization Number and wait for their superior partner (or Voltra) to approve.
- Staff tool: `npm run admin -- list | create | reset | assign | delete` (see `admin.js`).

## Layout
| Path | What |
|---|---|
| `server.js` | API, SolaX client (shared cache + rate guard), access checks |
| `auth.js` | accounts, sessions, roles, channel hierarchy |
| `push.js` | web push: alarms, automation scenes, partner sign-ups |
| `mailer.js` | email verification codes (SMTP) |
| `store.js` | storage: MongoDB or local files |
| `migrate.js` | one-off copy of `data/` files into MongoDB |
| `src/` | React app (customer tabs, business portfolio, login) |
| `data/` | local fallback storage — not committed |
