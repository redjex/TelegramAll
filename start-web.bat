@echo off
rem Starts the tweb dev server (with the lint overlay off) and prints where to look at the Android version.
cd /d "%~dp0tweb"
set TWEB_PREVIEW=1
set NODE_OPTIONS=--max-old-space-size=8192
echo.
echo   Android in a phone frame : http://localhost:8080/android-preview.html
echo   Android in the whole tab : http://localhost:8080/android.html
echo   Usual web version        : http://localhost:8080/
echo.
echo   (the first load takes a while: the dev server compiles the app on demand)
echo.
npx vite --host 127.0.0.1 --port 8080
