@echo off
rem ===========================================================================
rem Gymlic deploy (Windows + WinSCP).
rem
rem Nothing runs on the host, so a deploy is only ever "make the remote folder
rem look like the local one". The frontend is built here first because the host
rem has no Node; the backend is plain PHP and ships as-is.
rem
rem   deploy.bat          the frontend (build + upload) -- the usual case
rem   deploy.bat api      the PHP backend
rem   deploy.bat all      both
rem
rem Add -y to skip the confirmation prompt.
rem ===========================================================================
setlocal

set "HERE=%~dp0"
rem Resolve the repo root to a real path -- %~dp0.. would leave a ".." in
rem every message and in the path handed to WinSCP.
for %%i in ("%~dp0..") do set "ROOT=%%~fi"

set "TARGET=front"
set "ASSUME_YES="

for %%a in (%*) do (
  if /i "%%~a"=="-y" (set "ASSUME_YES=1") else (set "TARGET=%%~a")
)

if not exist "%HERE%deploy.config.bat" (
  echo.
  echo   deploy.config.bat not found.
  echo   Copy deploy.config.example.bat to deploy.config.bat and fill it in.
  echo.
  exit /b 1
)
call "%HERE%deploy.config.bat"

rem The default WinSCP path contains "(x86)", and cmd expands variables while
rem it parses a parenthesised block -- printing the path inside one would let
rem that ")" close the block early and break the script before it runs. Hence
rem the label instead of an if-block.
if exist "%WINSCP_COM%" goto :winscp_found
echo.
echo   WinSCP not found at: %WINSCP_COM%
echo   Fix WINSCP_COM in deploy.config.bat ^(it is WinSCP.com, not WinSCP.exe^).
echo.
exit /b 1
:winscp_found

if /i "%TARGET%"=="front" goto :ok
if /i "%TARGET%"=="api"   goto :ok
if /i "%TARGET%"=="all"   goto :ok
echo   Unknown target "%TARGET%". Use: front ^| api ^| all
exit /b 1
:ok

echo.
echo   session : %SESSION%
if /i not "%TARGET%"=="front" echo   backend : %ROOT%\backend-php  ^-^>  %REMOTE_API%   ^(keeps config.php and uploads^)
if /i not "%TARGET%"=="api" echo   frontend: %ROOT%\out  ^-^>  %REMOTE_FRONT%   ^(removes remote files that are no longer in the build^)
echo.

rem set /p has to run outside a parenthesised block: %GO% inside one would be
rem expanded when the block is parsed, i.e. before the answer is typed.
if defined ASSUME_YES goto :confirmed
set /p "GO=Continue? [y/N] "
if /i not "%GO%"=="y" (
  echo   Cancelled.
  exit /b 1
)
:confirmed

rem --- build ---------------------------------------------------------------
rem The build runs before anything is uploaded so that a compile error leaves
rem the host untouched.
if /i "%TARGET%"=="api" goto :upload

rem NEXT_PUBLIC_API_URL is read at build time and baked into the bundle, so it
rem has to be set here rather than on the host.
set "NEXT_PUBLIC_API_URL=%API_URL%"
echo.
echo   Building with NEXT_PUBLIC_API_URL=%NEXT_PUBLIC_API_URL%
pushd "%ROOT%"
call npm run build
if errorlevel 1 (
  popd
  echo.
  echo   Build failed -- nothing was uploaded.
  exit /b 1
)
popd

rem The build is only worth uploading if .htaccess made it into out/; without it
rem every /join/<code> invite link 404s.
if not exist "%ROOT%\out\.htaccess" (
  echo.
  echo   out\.htaccess is missing -- the build did not copy deploy\.htaccess.
  echo   Nothing was uploaded.
  exit /b 1
)

rem --- upload --------------------------------------------------------------
rem Backend before frontend, deliberately. A feature normally adds an endpoint
rem and the page that calls it; shipping the page first puts a live page in
rem front of a route the host does not serve yet, and whoever opens it in that
rem window gets an error. The other way round the new endpoint just sits unused
rem until the frontend catches up.
:upload
if /i "%TARGET%"=="front" goto :front

echo.
echo   Uploading the backend...
"%WINSCP_COM%" /log="%HERE%winscp.log" /script="%HERE%_sync-api.winscp" /parameter // "%SESSION%" "%ROOT%\backend-php" "%REMOTE_API%"
if errorlevel 1 goto :failed
if /i "%TARGET%"=="api" goto :done

:front
echo.
echo   Uploading the frontend...
"%WINSCP_COM%" /log="%HERE%winscp.log" /script="%HERE%_sync-front.winscp" /parameter // "%SESSION%" "%ROOT%\out" "%REMOTE_FRONT%"
if errorlevel 1 goto :failed

:done
echo.
echo   Done.
echo   Check %API_URL%/health -- it should say {"ok":true}.
exit /b 0

:failed
echo.
echo   Upload failed. See %HERE%winscp.log
exit /b 1
