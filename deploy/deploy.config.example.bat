@echo off
rem Copy this file to deploy.config.bat and fill in the four values below.
rem deploy.config.bat is gitignored.
rem
rem Note what is NOT here: the FTP password. Save the connection once in the
rem WinSCP window (Session > Save, tick "Save password") and reference it by
rem name -- that keeps the password in WinSCP's own store instead of a plain
rem text file sitting in the project folder.

rem WinSCP's console binary. Note the .com, not the .exe.
set "WINSCP_COM=C:\Program Files (x86)\WinSCP\WinSCP.com"

rem The name you gave the saved site in WinSCP.
set "SESSION=gymlic"

rem Remote folders, exactly as WinSCP's right-hand pane shows them.
set "REMOTE_FRONT=/domains/gymlic-panel.ir/public_html"
set "REMOTE_API=/domains/api.gymlic-panel.ir/public_html"

rem Baked into the frontend bundle at build time, and used by deploy.bat to
rem tell you which /health to check afterwards.
set "API_URL=https://api.gymlic-panel.ir"
