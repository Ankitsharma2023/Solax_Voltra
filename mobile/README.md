# Voltra phone app (React Native / Expo)

The Android + iOS version of the Voltra web app. It uses the same backend (`../server.js`) — nothing is
duplicated on the server. The app logs in with a bearer token (header `X-Voltra-Client: app`) kept in the
phone's secure storage; the website keeps using cookies.

- App name **Voltra**, app ID **in.voltra.app** (Android package and iOS bundle ID — final once published).
- Expo SDK 58, Expo Router (screens in `src/app/`), JavaScript.
- API: `https://voltra-app.onrender.com` (`extra.apiUrl` in `app.json`); override with `EXPO_PUBLIC_API_URL`.

## Run it

```bash
cd mobile
npm install
npx expo start            # scan the QR with Expo Go (Android) or the Camera app (iPhone)
```

Test against a local backend: `EXPO_PUBLIC_API_URL=http://<your-computer-ip>:4300 npx expo start`.
In a desktop browser: `npx expo start --web` (the server allows `http://localhost:*` for this).

## Versions and over-the-air (OTA) updates

Two kinds of releases:

1. **Store build** (`eas build`) — needed when native code changes (new native library, permissions,
   app icon, Expo SDK upgrade). Bump `version` in `app.json` for each store release.
2. **OTA update** (`eas update`) — JavaScript/screens/images only. Phones download it on next launch;
   Me → About → *Check for updates* applies it immediately. No store review.

`runtimeVersion` uses the **fingerprint** policy: an OTA update only reaches installed builds with the
same native code, so an update can never crash an older build that lacks a native module.

Channels (`eas.json`): `preview` (internal test APKs) and `production` (store builds).

### One-time setup (needs the Voltra Expo account)

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # adds the EAS project ID to app.json
npx eas-cli@latest update:configure   # adds updates.url to app.json
```

### Releasing

```bash
npx eas-cli@latest build --profile preview --platform android    # test APK to install directly
npx eas-cli@latest build --profile production --platform all     # store builds
npx eas-cli@latest submit --platform all                         # upload to Play Store / App Store
npx eas-cli@latest update --channel production --message "…"     # OTA update to installed apps
```

## Status

Ported: login (session saved on the phone), Home (live energy flow, battery, daily energy, benefits),
Me (account, plant switch, version + update check, log out).
Next: Device, Intelligence, Service, business Overview/Plants, push notifications, label scanner, Bluetooth.
