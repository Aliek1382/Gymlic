# Gymlic PHP/MySQL backend (shared-hosting rewrite)

Replaces the Supabase backend with plain PHP (no Composer/SSH required) + MySQL,
for deployment on ordinary Iranian cPanel shared hosting. The Next.js frontend
does not need to change structurally — only its `features/*/services/*.ts`
files need to call this REST API instead of `supabase-js`.

## Status

This is the MVP slice: full database schema + auth (signup/login/logout/me/
choose-role), club creation, and the invitation-accept flow (join as athlete /
join as trainer). Everything else in `../supabase/migrations` (members,
trainers, plans, exercises, foods, messages, revenue, admin panel, etc.) still
needs its own controller + routes, following the same pattern — see the
Supabase→PHP inventory this was built from for the full endpoint list per
feature.

## Deploying on shared hosting (no SSH)

1. In cPanel → MySQL Databases, create a database and a user, and add the user
   to the database with ALL PRIVILEGES.
2. In phpMyAdmin, select that database → Import → upload `schema/schema.sql`.
3. Upload this whole `backend-php/` folder via FTP/File Manager, in one of two
   layouts (both are supported and both keep `src/`, `config.php` and
   `schema/` unreachable over HTTP):

   **A. Subdomain (recommended).** Upload to `~/backend-php/`, then create a
   subdomain like `api.yourdomain.com` with its document root set to
   `backend-php/public`. Endpoints are then `https://api.yourdomain.com/health`.

   **B. Subfolder.** Upload the folder to `~/public_html/api/` (so that
   `public_html/api/.htaccess` and `public_html/api/public/` both exist).
   Endpoints are then `https://yourdomain.com/api/health`.

4. Edit `config.php`: the DB host/name/user/password from step 1, and your
   frontend's real origin(s) in `cors_origins`.
5. Make sure `public/uploads/` is writable by PHP (`755`, or `775` on some
   hosts).
6. Check the deployment: open `<your API base>/health` in a browser. You want
   `{"ok":true,"database":"connected","schema":"loaded"}`. `"database":
   "unavailable"` means step 4's credentials are wrong; `"schema":"missing"`
   means step 2 didn't run.
7. Point the frontend's API base URL at this deployment.

Both layouts are verified against Apache with `mod_rewrite`: requests route to
the front controller, `/uploads/...` is served straight off disk, and
`src/`, `schema/` and `config.php` are not fetchable.

## Local development

```
php -S 127.0.0.1:8099 public/index.php
```

Point `config.php` at a local MySQL/MariaDB database seeded from
`schema/schema.sql`.

## Auth model

Bearer-token sessions (`sessions` table), not cookies — the static frontend
export and this API commonly live on different (sub)domains on shared
hosting, where cross-site cookies are fragile. The frontend stores the token
(e.g. `localStorage`) and sends `Authorization: Bearer <token>`, the same
shape as the Supabase JWT it replaces.

## Adding a new feature/endpoint

1. Add a table to `schema/schema.sql` if needed (see the Postgres migration
   it corresponds to under `../supabase/migrations`).
2. Add a controller under `src/Controllers/`, using `Auth::requireUser()` /
   `Auth::requirePlatformAdmin()` for the authorization checks Postgres RLS
   used to do (each table's former RLS policy tells you exactly what to
   check — see the migration file).
3. Register its routes in `public/index.php`.
