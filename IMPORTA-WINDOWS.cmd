@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Installa Node.js 22 o successivo da https://nodejs.org/en/download poi riapri questo file.
  pause
  exit /b 1
)
echo Preparazione del trasferimento. Questa operazione puo richiedere alcuni minuti.
call npm ci
if errorlevel 1 (
  echo Preparazione non riuscita. Controlla la connessione e riprova.
  pause
  exit /b 1
)
node scripts/import-guided.mjs
pause
