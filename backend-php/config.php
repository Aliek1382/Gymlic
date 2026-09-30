<?php
declare(strict_types=1);

// Edit these to match your cPanel MySQL database (Databases > MySQL Databases).
// This file has no external dependencies on purpose — shared hosts without
// SSH/Composer can just upload it and edit the values below directly.
//
// Each value can also come from an environment variable, which local
// development uses; on a shared host, just edit the literals.

return [
    'db' => [
        'host'    => getenv('GYMLIC_DB_HOST') ?: 'localhost',
        'name'    => getenv('GYMLIC_DB_NAME') ?: 'cpaneluser_gymlic',
        'user'    => getenv('GYMLIC_DB_USER') ?: 'cpaneluser_gymlic',
        'pass'    => getenv('GYMLIC_DB_PASS') ?: 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],

    // Origins allowed to call this API (the Next.js site's domain(s)).
    // Use '*' only while developing locally.
    'cors_origins' => array_filter(explode(',', getenv('GYMLIC_CORS_ORIGINS') ?: 'http://localhost:3000')),

    // Session cookie lifetime, in seconds. Sessions are also stored server-side
    // in the `sessions` table so they can be revoked (logout / suspend).
    'session_ttl_seconds' => 60 * 60 * 24 * 30, // 30 days

    // SMS for notifications (SmsGateway; provider: Melipayamak token API).
    // With CHANGE_ME left in, SMS deliveries simply fail and are recorded as such.
    'sms' => [
        'provider' => getenv('GYMLIC_SMS_PROVIDER') ?: 'melipayamak',
        'api_key'  => getenv('GYMLIC_SMS_API_KEY') ?: 'CHANGE_ME',
        'sender'   => getenv('GYMLIC_SMS_SENDER') ?: 'CHANGE_ME',
    ],

    // Email for notifications (MailGateway). Uses PHP mail() unless 'smtp' has a host.
    'mail' => [
        'from_address' => getenv('GYMLIC_MAIL_FROM') ?: 'no-reply@gymlic-panel.ir',
        'from_name'    => 'جیم‌لیک',
        // Optional: a real mailbox on the domain, for better inbox placement than mail().
        'smtp' => [
            'host'   => getenv('GYMLIC_SMTP_HOST') ?: '', // '' = use mail()
            'port'   => (int) (getenv('GYMLIC_SMTP_PORT') ?: 465),
            'secure' => getenv('GYMLIC_SMTP_SECURE') ?: 'ssl', // 'ssl' (465) or 'tls' (587, STARTTLS)
            'user'   => getenv('GYMLIC_SMTP_USER') ?: '',
            'pass'   => getenv('GYMLIC_SMTP_PASS') ?: '',
        ],
    ],

    // Where uploaded avatars/logos are written on disk and the public URL
    // prefix used to build the value stored in profiles.avatar_url / clubs.logo_url.
    'uploads' => [
        'dir'        => __DIR__ . '/public/uploads',
        'public_url' => '/uploads', // served relative to this API's own domain/subfolder
        'max_bytes'  => 8 * 1024 * 1024,
    ],
];
