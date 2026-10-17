# TelegramAll

A native Windows desktop wrapper around [tweb](https://github.com/morethanwords/tweb) (Telegram Web K), with a few interface changes of its own.

- `tweb/` – the Telegram Web K source with local changes (Money wallet view, Gram transfer cards, profile background, stories grid fixes and more).
- `desktop/` – the Electron shell that serves the built `tweb/dist` and packages it as `TelegramAll.exe`.

## Build

```bash
cd tweb
pnpm install
npx vite build          # writes tweb/dist
cp -rn public/. dist/   # vite does not copy the public folder

cd ../desktop
npm install
npx electron-builder --win dir   # desktop/release/win-unpacked/TelegramAll.exe
```

## Android version

`mobile/` is a Capacitor project that wraps `tweb/dist` as an Android app (`cd mobile && npx cap sync android`, then `gradlew assembleDebug` in `mobile/android`; it needs JDK 21 and the Android SDK).
The login screens copy the official Telegram for Android and switch on only for an Android user agent.

To work on it without a phone or an emulator, run `start-web.bat` (it starts the dev server) and open
<http://localhost:8080/android-preview.html>: the app in a phone frame with the Android version switched on.
Only inside that frame, and for an Android user agent (Chrome's device mode, a phone): the usual web client at
`http://localhost:8080/` stays as it was.

## Separate test profile

`TelegramAll.exe --profile=dev` (or `npm run start:profile` in `desktop/`) runs the built app with its own logins, chats and caches in `%APPDATA%\TelegramAll-dev` and its own local port, so it can run next to the main profile and never touches it.

## Live development in the Windows app

After installing `tweb/` dependencies with pnpm and `desktop/` dependencies with npm, double-click **`start-windows.bat`** in the repository root. It checks the required tools and dependencies, starts the current checkout with automatic updates, and keeps errors visible if startup fails. Keep its console open while testing; close the app to stop. It also works when invoked from another directory. The launcher uses the local source files; it does not switch branches or pull from GitHub.

The equivalent terminal command is:

```powershell
npm --prefix desktop run dev
```

The launcher runs Vite's build watcher and opens Electron with the `dev` profile after the first successful build. Saving UI code or styles automatically rebuilds the bundle and reloads the page. This is automatic rebuild-and-reload, rather than in-place HMR: an open popup may close during an update. Changes to `desktop/main.js`, `desktop/server.js` or `desktop/liveReload.js` restart the window automatically. Changes to the launcher itself need a new launch.

Development bundles go to the ignored `tweb/tmp/desktop-dist/`, served at the profile's usual `http://localhost:47825` address. Login, IndexedDB, localStorage and media remain in the same profile. Only the service worker is unregistered for an update so old cached code cannot mask a change. Runtime assets are served from `tweb/public/` without copying its old compiled code over the new bundle. Background throttling is disabled in this development window so startup and reload can finish without focusing it.

Failed builds leave the preceding working page and chunks available. Fix the error and save to retry automatically. The first build is slower; subsequent builds reuse the project's transform cache, omit minification and source maps, and keep prior chunks for in-flight requests. After a long session, the ignored `tweb/tmp/desktop-dist/` directory may be removed once the launcher has stopped to reclaim space. No browser dev server is started or stopped, and packaged releases still use `tweb/dist` with their usual behavior. Close an existing built window using the `dev` profile before starting the launcher for the first time.

Checks: `npm --prefix desktop test` covers serving and reload coordination. `npm --prefix desktop run test:electron` runs the watcher, an intentional syntax failure and recovery in a hidden, isolated Electron test window; it does not use the developer's Telegram profile or take focus. Application checks must still be run separately when changing client code.

Logins, chats, contacts and caches are stored outside the repository, in `%APPDATA%\TelegramAll`, and are never committed (see `.gitignore` and the `pre-commit` hook).

## License

[GPL-3.0](LICENSE). tweb is licensed under GPL-3.0 and this project is derived from it, so the whole repository is too.
Telegram and the Telegram logo are trademarks of Telegram FZ-LLC; this is an unofficial client.
