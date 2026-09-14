@echo off
setlocal EnableDelayedExpansion
title Fix ^& Drive - Laptop Setup

REM ===========================================================================
REM  Fix & Drive - Windows setup
REM
REM  Puts Fix & Drive on the laptop as a proper app:
REM    - its own window, no address bar, no tabs
REM    - its own icon on the desktop and the taskbar
REM    - opens by itself every time he signs in
REM
REM  The laptop stays completely normal otherwise: the window can be minimised
REM  or closed, and everything else works as usual.
REM
REM  Nothing is installed. It only creates two shortcuts, and option 2 removes
REM  them again.
REM ===========================================================================

set "URL=https://moesb1.github.io/fixanddrive/"
set "APPDIR=%LOCALAPPDATA%\FixAndDrive"
set "ICON=%APPDIR%\fixanddrive.ico"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNKNAME=Fix and Drive.lnk"

echo.
echo  ===========================================================
echo    FIX ^& DRIVE  -  Laptop Setup
echo  ===========================================================
echo.
echo    1  -  Set it up  (desktop icon + opens when you sign in)
echo    2  -  Remove it  (takes the shortcuts away)
echo    3  -  Cancel
echo.
set /p "CHOICE=  Type 1, 2 or 3 then press Enter: "

if "%CHOICE%"=="2" goto REMOVE
if "%CHOICE%"=="3" goto CANCEL
if not "%CHOICE%"=="1" goto CANCEL

REM ---------------------------------------------------------------------------
REM  Find a browser. Edge ships with Windows, so it is the safe fallback, but
REM  Chrome is preferred when it is there.
REM ---------------------------------------------------------------------------
set "BROWSER="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do (
  if not defined BROWSER if exist %%P set "BROWSER=%%~P"
)

if not defined BROWSER (
  echo.
  echo  [X] Could not find Chrome or Edge on this computer.
  echo      Install Google Chrome, then run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo  Using: !BROWSER!

REM ---------------------------------------------------------------------------
REM  Fetch the app icon so the shortcut is not a generic browser icon.
REM  curl ships with Windows 10 build 1803 and later.
REM ---------------------------------------------------------------------------
if not exist "%APPDIR%" mkdir "%APPDIR%" >nul 2>&1
echo  Getting the app icon...
curl -s -L -o "%ICON%" "%URL%icons/fixanddrive.ico" >nul 2>&1

if not exist "%ICON%" (
  echo  [!] Could not download the icon - the shortcut will use the browser icon.
  set "ICON=!BROWSER!"
)

REM ---------------------------------------------------------------------------
REM  --app= is what removes the address bar and tabs: the site opens in its own
REM  plain window. --start-maximized fills the screen without locking him in,
REM  so the window can still be minimised and the laptop used normally.
REM ---------------------------------------------------------------------------
set "ARGS=--app=%URL% --start-maximized"

echo  Making the shortcuts...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "foreach ($dir in @([Environment]::GetFolderPath('Desktop'), '%STARTUP%')) {" ^
  "  $lnk = $ws.CreateShortcut((Join-Path $dir '%LNKNAME%'));" ^
  "  $lnk.TargetPath       = '%BROWSER%';" ^
  "  $lnk.Arguments        = '%ARGS%';" ^
  "  $lnk.IconLocation     = '%ICON%';" ^
  "  $lnk.WorkingDirectory = (Split-Path '%BROWSER%');" ^
  "  $lnk.Description      = 'Fix and Drive - garage manager';" ^
  "  $lnk.Save();" ^
  "}" 2>nul

if errorlevel 1 (
  echo.
  echo  [X] Could not create the shortcuts.
  echo.
  pause
  exit /b 1
)

echo.
echo  ===========================================================
echo    DONE
echo  ===========================================================
echo.
echo    - "Fix and Drive" is on the desktop now.
echo    - It will open by itself next time you sign in.
echo    - It opens in its own window, with no address bar.
echo    - The laptop works normally otherwise: minimise or close
echo      the window any time.
echo.
echo    It also works with no internet once it has been opened
echo    once while online.
echo.
set /p "OPENNOW=  Open it now? (Y/N): "
if /i "%OPENNOW%"=="Y" start "" "%BROWSER%" %ARGS%
echo.
pause
exit /b 0

REM ---------------------------------------------------------------------------
:REMOVE
echo.
echo  Removing the shortcuts...
del "%STARTUP%\%LNKNAME%" >nul 2>&1
del "%USERPROFILE%\Desktop\%LNKNAME%" >nul 2>&1
powershell -NoProfile -Command ^
  "$d=[Environment]::GetFolderPath('Desktop');" ^
  "Remove-Item (Join-Path $d '%LNKNAME%') -ErrorAction SilentlyContinue" 2>nul
echo.
echo  Done. It will not open on sign in any more.
echo  Your bills, jobs and parts are untouched - they are saved
echo  inside the browser, not in the shortcut.
echo.
pause
exit /b 0

REM ---------------------------------------------------------------------------
:CANCEL
echo.
echo  Nothing was changed.
echo.
pause
exit /b 0
