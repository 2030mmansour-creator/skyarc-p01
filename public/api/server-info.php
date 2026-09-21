<?php
/**
 * Server Info & Health Check Endpoint for Hostinger / PHP
 */

@error_reporting(0);
@ini_set('display_errors', '0');

if (!ob_get_level()) {
    ob_start();
} else {
    ob_clean();
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: *');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['status' => 'ok']);
    exit(0);
}

$dir = __DIR__;
$candidates = [
    $dir . '/data/system_state.json',
    $dir . '/system_state.json',
    dirname($dir) . '/system_state.json',
    sys_get_temp_dir() . '/skyarc_system_state.json'
];

$activeFile = $candidates[0];
$found = false;
foreach ($candidates as $filePath) {
    if (file_exists($filePath)) {
        $activeFile = $filePath;
        $found = true;
        break;
    }
}

$exists = file_exists($activeFile);
$fileSizeKb = $exists ? round(filesize($activeFile) / 1024, 2) : 0;
$lastModified = $exists ? date('c', filemtime($activeFile)) : null;

$version = 1;
$stats = null;
if ($exists) {
    $raw = @file_get_contents($activeFile);
    if ($raw) {
        $json = json_decode($raw, true);
        if ($json) {
            $version = isset($json['serverVersion']) ? (int)$json['serverVersion'] : (isset($json['version']) ? (int)$json['version'] : 1);
            $stats = [
                'expenses' => isset($json['expenses']) && is_array($json['expenses']) ? count($json['expenses']) : 0,
                'projects' => isset($json['projects']) && is_array($json['projects']) ? count($json['projects']) : 0,
                'custodies' => isset($json['custodies']) && is_array($json['custodies']) ? count($json['custodies']) : 0,
                'users' => isset($json['users']) && is_array($json['users']) ? count($json['users']) : 0
            ];
        }
    }
}

$parentDir = dirname($activeFile);
$isWritable = is_writable($parentDir) || (file_exists($activeFile) && is_writable($activeFile));

ob_clean();
echo json_encode([
    'status' => 'online',
    'mode' => 'hostinger_php_disk_storage',
    'serverEngine' => 'PHP ' . PHP_VERSION,
    'exists' => $exists,
    'fileSizeKb' => $fileSizeKb,
    'lastModified' => $lastModified,
    'version' => $version,
    'stats' => $stats,
    'storageFile' => basename($parentDir) . '/' . basename($activeFile),
    'isWritable' => $isWritable,
    'phpVersion' => PHP_VERSION,
    'postMaxSize' => ini_get('post_max_size'),
    'uploadMaxFilesize' => ini_get('upload_max_filesize')
], JSON_UNESCAPED_UNICODE);
