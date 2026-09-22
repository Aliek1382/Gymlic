<?php
declare(strict_types=1);

// Edit these to match your cPanel MySQL database (Databases > MySQL Databases).
// This file has no external dependencies on purpose — shared hosts without
// SSH/Composer can just upload it and edit the values below directly.

return [
    'db' => [
        'host'    => 'localhost',
        'name'    => 'cpaneluser_gymlic',
        'user'    => 'cpaneluser_gymlic',
        'pass'    => 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],

    // Comma-separated list of origins allowed to call this API (the Next.js
    // static site's domain(s)). Use '*' only while developing locally.
    'cors_origins' => [
        'http://localhost:3000',
    ],

    // Session cookie lifetime, in seconds. Sessions are also stored server-side
    // in the `sessions` table so they can be revoked (logout / suspend).
    'session_ttl_seconds' => 60 * 60 * 24 * 30, // 30 days

    // Where uploaded avatars/logos are written on disk and the public URL
    // prefix used to build the value stored in profiles.avatar_url / clubs.logo_url.
    'uploads' => [
        'dir'        => __DIR__ . '/public/uploads',
        'public_url' => '/uploads', // served relative to this API's own domain/subfolder
        'max_bytes'  => 8 * 1024 * 1024,
    ],
];
