<?php

declare(strict_types=1);

const ORYVOM_MAX_BYTES = 10485760;
const ORYVOM_SKEW_SECONDS = 120;

function oryvom_config(): array
{
    $path = __DIR__ . "/config.php";
    if (!is_file($path)) {
        oryvom_fail(503, "config_missing");
    }
    $config = require $path;
    if (!is_array($config)) {
        oryvom_fail(503, "config_invalid");
    }
    $secret = $config["secret"] ?? "";
    $storage = $config["storage_dir"] ?? "";
    $nonces = $config["nonce_dir"] ?? "";
    if (!is_string($secret) || strlen($secret) < 32 || str_starts_with($secret, "replace-with")) {
        oryvom_fail(503, "secret_rejected");
    }
    if (!is_string($storage) || !is_string($nonces)) {
        oryvom_fail(503, "config_invalid");
    }
    if (!is_dir($storage) || !is_dir($nonces)) {
        oryvom_fail(503, "storage_directory_missing");
    }
    $config["secret"] = $secret;
    $config["storage_dir"] = $storage;
    $config["nonce_dir"] = $nonces;
    return $config;
}

function oryvom_store(): void
{
    $config = oryvom_begin();
    $body = oryvom_read_body(ORYVOM_MAX_BYTES);
    oryvom_authorize($config, "/store.php", $body, "");
    $type = oryvom_detect($body);
    if ($type === null) {
        oryvom_fail(415, "unsupported_file_type");
    }
    $key = oryvom_uuid();
    $directory = $config["storage_dir"];
    $partial = $directory . "/" . $key . ".partial";
    $final = $directory . "/" . $key;
    $meta = $directory . "/" . $key . ".json";
    if (file_put_contents($partial, $body, LOCK_EX) === false) {
        oryvom_fail(500, "store_failed");
    }
    chmod($partial, 0640);
    if (!rename($partial, $final)) {
        @unlink($partial);
        oryvom_fail(500, "store_failed");
    }
    $sidecar = json_encode([
        "sha256" => hash("sha256", $body),
        "contentType" => $type,
        "byteSize" => strlen($body),
    ], JSON_THROW_ON_ERROR);
    if (file_put_contents($meta, $sidecar, LOCK_EX) === false) {
        @unlink($final);
        oryvom_fail(500, "store_failed");
    }
    chmod($meta, 0640);
    oryvom_json(201, ["storageKey" => $key]);
}

function oryvom_fetch(): void
{
    $config = oryvom_begin();
    $body = oryvom_read_body(0);
    $key = oryvom_header("HTTP_X_ORYVOM_STORAGE_KEY");
    oryvom_authorize($config, "/fetch.php", $body, $key);
    $paths = oryvom_paths($config["storage_dir"], $key);
    if (!is_file($paths["file"]) || !is_file($paths["meta"])) {
        oryvom_fail(404, "document_missing");
    }
    $meta = json_decode((string) file_get_contents($paths["meta"]), true);
    $bytes = file_get_contents($paths["file"]);
    if (!is_array($meta) || !is_string($bytes)) {
        oryvom_fail(500, "document_unreadable");
    }
    $contentType = $meta["contentType"] ?? "";
    $sha = $meta["sha256"] ?? "";
    if (!is_string($contentType) || !is_string($sha) || !hash_equals($sha, hash("sha256", $bytes))) {
        oryvom_fail(500, "document_unreadable");
    }
    if (!in_array($contentType, ["application/pdf", "image/jpeg", "image/png"], true)) {
        oryvom_fail(500, "document_type_rejected");
    }
    http_response_code(200);
    header("Content-Type: " . $contentType);
    header("Content-Disposition: attachment");
    header("X-Content-Type-Options: nosniff");
    header("Cache-Control: no-store");
    header("X-Oryvom-Content-Sha256: " . $sha);
    echo $bytes;
    exit;
}

function oryvom_remove(): void
{
    $config = oryvom_begin();
    $body = oryvom_read_body(0);
    $key = oryvom_header("HTTP_X_ORYVOM_STORAGE_KEY");
    oryvom_authorize($config, "/remove.php", $body, $key);
    $paths = oryvom_paths($config["storage_dir"], $key);
    if (is_file($paths["file"])) {
        unlink($paths["file"]);
    }
    if (is_file($paths["meta"])) {
        unlink($paths["meta"]);
    }
    oryvom_json(200, ["ok" => true]);
}

function oryvom_begin(): array
{
    ini_set("display_errors", "0");
    header("X-Content-Type-Options: nosniff");
    header("Referrer-Policy: no-referrer");
    header("Cache-Control: no-store");
    header("X-Frame-Options: DENY");
    if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
        oryvom_fail(405, "method_rejected");
    }
    $https = ($_SERVER["HTTPS"] ?? "") === "on" || strtolower((string) ($_SERVER["HTTP_X_FORWARDED_PROTO"] ?? "")) === "https";
    if (!$https) {
        oryvom_fail(403, "https_required");
    }
    return oryvom_config();
}

function oryvom_authorize(array $config, string $path, string $body, string $storageKey): void
{
    $timestamp = oryvom_header("HTTP_X_ORYVOM_TIMESTAMP");
    $nonce = oryvom_header("HTTP_X_ORYVOM_NONCE");
    $declared = strtolower(oryvom_header("HTTP_X_ORYVOM_CONTENT_SHA256"));
    $signature = strtolower(oryvom_header("HTTP_X_ORYVOM_SIGNATURE"));
    $headerKey = oryvom_header("HTTP_X_ORYVOM_STORAGE_KEY");
    if ($storageKey !== "" && !oryvom_uuid_ok($storageKey)) {
        oryvom_fail(400, "storage_key_invalid");
    }
    if (!hash_equals($storageKey, $headerKey)) {
        oryvom_fail(401, "storage_key_mismatch");
    }
    if (!preg_match("/^[0-9]{10}$/", $timestamp) || abs(time() - (int) $timestamp) > ORYVOM_SKEW_SECONDS) {
        oryvom_fail(401, "timestamp_rejected");
    }
    if (!preg_match("/^[A-Za-z0-9_-]{16,128}$/", $nonce)) {
        oryvom_fail(401, "nonce_rejected");
    }
    if (!preg_match("/^[a-f0-9]{64}$/", $declared) || !preg_match("/^[a-f0-9]{64}$/", $signature)) {
        oryvom_fail(401, "signature_rejected");
    }
    $actual = hash("sha256", $body);
    if (!hash_equals($declared, $actual)) {
        oryvom_fail(401, "content_hash_mismatch");
    }
    $payload = implode("\n", ["v1", $timestamp, $nonce, "POST", $path, $declared, $storageKey]);
    $expected = hash_hmac("sha256", $payload, $config["secret"]);
    if (!hash_equals($expected, $signature)) {
        oryvom_fail(401, "signature_mismatch");
    }
    oryvom_consume_nonce($config["nonce_dir"], $config["secret"], $nonce);
}

function oryvom_consume_nonce(string $directory, string $secret, string $nonce): void
{
    $now = time();
    foreach (glob($directory . "/*") ?: [] as $file) {
        if (is_file($file) && $now - (int) filemtime($file) > 600) {
            @unlink($file);
        }
    }
    $name = $directory . "/" . hash_hmac("sha256", $nonce, $secret);
    if (is_file($name)) {
        oryvom_fail(401, "nonce_reused");
    }
    if (file_put_contents($name, "1", LOCK_EX) === false) {
        oryvom_fail(500, "nonce_store_failed");
    }
}

function oryvom_read_body(int $max): string
{
    $declared = (int) ($_SERVER["CONTENT_LENGTH"] ?? 0);
    if ($declared < 0 || $declared > $max) {
        oryvom_fail(413, "body_too_large");
    }
    $handle = fopen("php://input", "rb");
    if ($handle === false) {
        oryvom_fail(400, "body_unreadable");
    }
    $body = "";
    while (!feof($handle)) {
        $chunk = fread($handle, 8192);
        if ($chunk === false) {
            break;
        }
        $body .= $chunk;
        if (strlen($body) > $max) {
            fclose($handle);
            oryvom_fail(413, "body_too_large");
        }
    }
    fclose($handle);
    return $body;
}

function oryvom_detect(string $body): ?string
{
    if (str_starts_with($body, "%PDF-")) {
        return "application/pdf";
    }
    if (strlen($body) >= 3 && substr($body, 0, 3) === "\xFF\xD8\xFF") {
        return "image/jpeg";
    }
    if (strlen($body) >= 8 && substr($body, 0, 8) === "\x89PNG\x0D\x0A\x1A\x0A") {
        return "image/png";
    }
    return null;
}

function oryvom_paths(string $directory, string $key): array
{
    if (!oryvom_uuid_ok($key)) {
        oryvom_fail(400, "storage_key_invalid");
    }
    $root = realpath($directory);
    if ($root === false) {
        oryvom_fail(500, "storage_directory_unreadable");
    }
    return [
        "file" => $root . DIRECTORY_SEPARATOR . $key,
        "meta" => $root . DIRECTORY_SEPARATOR . $key . ".json",
    ];
}

function oryvom_uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . "-" . substr($hex, 8, 4) . "-" . substr($hex, 12, 4) . "-" . substr($hex, 16, 4) . "-" . substr($hex, 20, 12);
}

function oryvom_uuid_ok(string $value): bool
{
    return preg_match("/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i", $value) === 1;
}

function oryvom_header(string $name): string
{
    $value = $_SERVER[$name] ?? "";
    return is_string($value) ? trim($value) : "";
}

function oryvom_json(int $status, array $payload): void
{
    http_response_code($status);
    header("Content-Type: application/json");
    echo json_encode($payload, JSON_THROW_ON_ERROR);
    exit;
}

function oryvom_log_read(): void
{
    $config = oryvom_begin();
    $body = oryvom_read_body(0);
    oryvom_authorize($config, "/log.php", $body, "");
    $path = __DIR__ . "/logs/host.log";
    $text = is_file($path) ? (string) file_get_contents($path) : "";
    if (strlen($text) > 65536) {
        $text = substr($text, -65536);
    }
    http_response_code(200);
    header("Content-Type: text/plain; charset=utf-8");
    header("X-Content-Type-Options: nosniff");
    header("Cache-Control: no-store");
    echo $text === "" ? "No storage errors have been recorded.\n" : $text;
    exit;
}

function oryvom_log(int $status, string $reason): void
{
    $safeReason = preg_match("/^[a-z0-9_]{1,64}$/", $reason) === 1 ? $reason : "rejected";
    $line = gmdate("Y-m-d\\TH:i:s\\Z") . " " . oryvom_endpoint() . " " . $status . " " . $safeReason . "\n";
    $directory = __DIR__ . "/logs";
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        return;
    }
    $path = $directory . "/host.log";
    $existing = is_file($path) ? (int) filesize($path) : 0;
    if ($existing > 262144) {
        $current = (string) file_get_contents($path);
        $tail = substr($current, -131072);
        $break = strpos($tail, "\n");
        $trimmed = $break === false ? $tail : substr($tail, $break + 1);
        file_put_contents($path, $trimmed . $line, LOCK_EX);
    } else {
        file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
    }
    @chmod($path, 0640);
}

function oryvom_endpoint(): string
{
    $script = basename((string) ($_SERVER["SCRIPT_NAME"] ?? ""));
    if (in_array($script, ["store.php", "fetch.php", "remove.php", "log.php"], true)) {
        return $script;
    }
    return "unknown";
}

function oryvom_fail(int $status, string $reason = "rejected"): void
{
    oryvom_log($status, $reason);
    if (!headers_sent()) {
        http_response_code($status);
        header("Content-Type: application/json");
        header("X-Content-Type-Options: nosniff");
        header("Cache-Control: no-store");
    }
    echo "{\"error\":\"rejected\"}";
    exit;
}
