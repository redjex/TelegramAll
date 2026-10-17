@echo off
setlocal
title TelegramAll - Windows live test

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm is not available in PATH. Reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

if not exist "%~dp0desktop\dev.js" (
  echo This checkout does not contain the Windows development launcher.
  echo Use the branch that includes desktop/dev.js, then try again.
  pause
  exit /b 1
)

if not exist "%~dp0tweb\node_modules\vite\dist\node\index.js" (
  echo Web dependencies are missing. Run once from the project folder:
  echo   pnpm --dir "%~dp0tweb" install --frozen-lockfile
  pause
  exit /b 1
)

if not exist "%~dp0desktop\node_modules\electron\dist\electron.exe" (
  echo Desktop dependencies are missing. Run once from the project folder:
  echo   npm --prefix "%~dp0desktop" ci
  pause
  exit /b 1
)

echo.
echo   TelegramAll - live Windows testing
echo   The app opens after the first successful build. Please wait.
echo   Save source files to rebuild and update the app automatically.
echo   Your separate dev profile keeps its login between launches.
echo   Keep this console open while testing. Close the app to stop.
echo   If an older dev-profile window is open, close it first.
echo.

call npm.cmd --prefix "%~dp0desktop" run dev
set "launchExit=%ERRORLEVEL%"
if not "%launchExit%"=="0" (
  echo.
  echo Windows test launcher stopped with error %launchExit%. See the messages above.
  pause
)
exit /b %launchExit%
