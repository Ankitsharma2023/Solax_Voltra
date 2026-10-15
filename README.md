# Voltra Energy app (SolaX Cloud)

Installable web app (PWA) for Voltra customers, installers and distributors, modelled on the SolaX Cloud app.
Live data comes from the SolaX Developer Portal OpenAPI; the SolaX key never leaves the server.

## Run locally
```bash
npm install
cp .env.example .env   # fill in the SolaX keys, VAPID keys, SESSION_SECRET
npm run dev            # backend on :4300 + app on http://localhost:5173
```
Production: `npm run build && npm start` (the server serves `dist/` and the API on one port).

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
| `src/` | React app (customer tabs, business portfolio, login) |
| `data/` | runtime data (accounts, push subscriptions) — not committed |
