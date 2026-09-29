<?php
declare(strict_types=1);

// One-off diagnostic for browser push (Web Push): can this host encrypt a push
// message and reach the push services? Run it once from the host's cron (or a
// shell) and read the output; it changes nothing and can be deleted afterwards.
//
//   /usr/local/bin/php /home/USER/.../backend-php/cron/push-check.php >/home/USER/push-check.log 2>&1
//
// Command line only: over HTTP it answers 404.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

echo 'PHP ', PHP_VERSION, "\n\n== functions Web Push needs ==\n";
foreach (['openssl_pkey_new', 'openssl_pkey_derive', 'openssl_sign', 'openssl_encrypt', 'hash_hkdf', 'random_bytes', 'curl_init'] as $fn) {
    echo str_pad($fn, 22), function_exists($fn) ? 'OK' : 'MISSING', "\n";
}

echo "\n== key generation (P-256, the curve Web Push uses) ==\n";
$key = function_exists('openssl_pkey_new')
    ? @openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC])
    : false;
echo $key === false ? "FAILED\n" : "OK\n";

echo "\n== reaching the push services (any HTTP status means reachable) ==\n";
$hosts = [
    'Chrome/Android (Google FCM)' => 'https://fcm.googleapis.com/',
    'Firefox (Mozilla)'           => 'https://updates.push.services.mozilla.com/',
    'Safari/iPhone (Apple)'       => 'https://web.push.apple.com/',
    'Edge (Microsoft)'            => 'https://wns2-par02p.notify.windows.com/',
];
foreach ($hosts as $label => $url) {
    if (!function_exists('curl_init')) {
        echo str_pad($label, 30), "curl missing\n";
        continue;
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_NOBODY => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_RETURNTRANSFER => true]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    echo str_pad($label, 30), $code > 0 ? "REACHABLE (HTTP {$code})" : "BLOCKED: {$err}", "\n";
}
