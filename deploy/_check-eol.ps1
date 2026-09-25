# Fails when a file the Linux host parses carries Windows line endings.
#
# deploy.bat uploads in binary mode, so the working tree is byte-for-byte what
# lands on the server. A CRLF .htaccess puts a stray carriage return on the end
# of every directive -- "[QSA,L]" arrives as "[QSA,L]\r" -- and Apache answers
# the next request with a 500. The API is down before anyone notices the deploy
# succeeded, which is why this runs before the upload rather than after.
param([Parameter(Mandatory = $true)][string]$Root)

$bad = @(
  foreach ($pattern in '.htaccess', '*.php', '*.sh') {
    Get-ChildItem -LiteralPath $Root -Filter $pattern -Recurse -File -Force -ErrorAction SilentlyContinue |
      Where-Object { [IO.File]::ReadAllBytes($_.FullName) -contains 13 } |
      Select-Object -ExpandProperty FullName
  }
)

if ($bad.Count -eq 0) { exit 0 }

Write-Host ''
Write-Host '  These files have Windows line endings and would break the API:'
$bad | Select-Object -First 5 | ForEach-Object { Write-Host "    $_" }
if ($bad.Count -gt 5) { Write-Host "    ... and $($bad.Count - 5) more" }
Write-Host ''
Write-Host '  .gitattributes pins them to LF, but a tree checked out before that'
Write-Host '  rule existed still holds CRLF. Refresh it from the project root:'
Write-Host ''
Write-Host '      git rm --cached -r .'
Write-Host '      git reset --hard'
Write-Host ''
exit 1
