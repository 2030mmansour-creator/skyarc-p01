<?php
/**
 * Backups List and Restore for Hostinger / PHP
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    $dataDir = sys_get_temp_dir() . '/skyarc_hostinger_data';
}
$backupsDir = $dataDir . '/backups';
$stateFile = $dataDir . '/system_state.json';

// GET: list backups
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $files = glob($backupsDir . '/*.json');
    $list = [];
    if ($files) {
        foreach ($files as $file) {
            $list[] = [
                'filename' => basename($file),
                'sizeKb' => round(filesize($file) / 1024, 2),
                'createdAt' => date('c', filemtime($file))
            ];
        }
        usort($list, function($a, $b) {
            return strcmp($b['createdAt'], $a['createdAt']);
        });
    }
    echo json_encode(['success' => true, 'backups' => $list], JSON_UNESCAPED_UNICODE);
    exit;
}

// POST: restore backup
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);
    $filename = isset($payload['filename']) ? basename($payload['filename']) : '';

    if (empty($filename)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Backup filename required'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $backupPath = $backupsDir . '/' . $filename;
    if (!file_exists($backupPath)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Backup file not found'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (@copy($backupPath, $stateFile)) {
        echo json_encode(['success' => true, 'restoredFrom' => $filename, 'restoredAt' => date('c')], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to restore backup file'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
