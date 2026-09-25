# Gymlic

Gym-management SaaS. Persian, RTL throughout. Next.js static export +
plain PHP 8 + MySQL.

## This is live

The project runs in production on Iranian shared hosting. Treat every
change as a change to a running site, not to a prototype.

| | |
| --- | --- |
| Site | `https://gymlic-panel.ir` — static export of `out/` |
| API | `https://api.gymlic-panel.ir` — `backend-php/`, PHP 8.1, no Composer |
| Database | MySQL on the same host, reached only through phpMyAdmin |

There is no Supabase and no Vercel. Both were removed deliberately; the
`supabase/migrations/` folder is kept as a historical reference for the
old Postgres schema and nothing reads it.

## Deploys are the owner's to run, not ours

Deployment happens from the owner's Windows machine with
`deploy\deploy.bat` (WinSCP over FTP). We cannot reach the host, and no
CI deploys anything. So:

- **A merged PR is not a deployed change.** Say what still has to happen.
- **Schema changes ship their exact SQL in the PR description.** The
  owner runs it by hand in phpMyAdmin; the deploy script never touches
  the database. Never tell them to re-import `schema/schema.sql` — it
  errors on existing tables and changes nothing.
- **Order matters**: database first, then backend, then frontend. A page
  that reaches the host before its endpoint is a live error for anyone
  who opens it.

## Things that break if forgotten

- **`backend-php/config.php` holds real credentials and is not in git.**
  The committed copy says `CHANGE_ME` and would take the API down. The
  deploy script masks it. Never instruct anyone to overwrite it.
- **The owner is on Windows.** Anything in `package.json` scripts or in
  `deploy/` has to run under cmd.exe. A Unix `cp` in the build script
  already shipped once and broke a deploy.
- **`.gitattributes` pins line endings.** `.htaccess`, `*.php`, `*.sh`
  and `*.sql` are LF because Apache rejects a CRLF `.htaccess` with a
  500; the Windows-side scripts are CRLF. Adding a file type that the
  host parses means adding it there.
- **The frontend deploy deletes.** Anything not in `out/` is removed from
  the site's `public_html`.

## Before proposing a change

Read the deploy sections of `README.md` — the feature cycle, the
troubleshooting entries, and the backend recovery steps are all written
down, each from something that actually went wrong on this host.
`docs/deploy-guide/` is the same material as a PDF for the owner.
