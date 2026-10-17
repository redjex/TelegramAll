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
<http://localhost:8080/android-preview.html>: the app in a phone frame, with the Android version forced on.
`/android.html` does the same in the whole tab. Only the page that forces it needs this; the app itself looks at the user agent.

## Separate test profile

`TelegramAll.exe --profile=dev` (or `npm run dev` in `desktop/`) runs the same code with its own logins, chats and caches in `%APPDATA%\TelegramAll-dev` and its own local port, so it can run next to the main profile and never touches it.

Logins, chats, contacts and caches are stored outside the repository, in `%APPDATA%\TelegramAll`, and are never committed (see `.gitignore` and the `pre-commit` hook).

## License

[GPL-3.0](LICENSE). tweb is licensed under GPL-3.0 and this project is derived from it, so the whole repository is too.
Telegram and the Telegram logo are trademarks of Telegram FZ-LLC; this is an unofficial client.
