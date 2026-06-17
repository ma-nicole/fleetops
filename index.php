<?php
/**
 * Hostinger Apache/LiteSpeed entry fallback.
 * Prevents 403 when the document root has no index.php/index.html until Node.js is deployed.
 */
header('Content-Type: text/html; charset=utf-8');
$index = __DIR__ . '/index.html';
if (is_readable($index)) {
    readfile($index);
    exit;
}
http_response_code(503);
echo '<!DOCTYPE html><html><body><h1>FleetOps</h1><p>Deployment incomplete. See HOSTINGER.md.</p></body></html>';
