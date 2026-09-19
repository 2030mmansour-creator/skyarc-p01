<?php
/**
 * Archived Expenses Storage Handler for Hostinger / PHP
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

$archiveFile = $dataDir . '/archived_expenses.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!file_exists($archiveFile)) {
        echo json_encode(['success' => true, 'exists' => false, 'expenses' => []], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $raw = @file_get_contents($archiveFile);
    $data = json_decode($raw, true) ?: [];
    echo json_encode([
        'success' => true,
        'exists' => true,
        'count' => count($data),
        'expenses' => $data,
        'lastModified' => date('c', filemtime($archiveFile))
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);
    if ($payload === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $expensesToArchive = isset($payload['expenses']) && is_array($payload['expenses']) ? $payload['expenses'] : (is_array($payload) ? $payload : []);

    $existing = [];
    if (file_exists($archiveFile)) {
        $rawOld = @file_get_contents($archiveFile);
        $existing = json_decode($rawOld, true) ?: [];
    }

    $map = [];
    foreach ($existing as $e) {
        if (isset($e['id'])) $map[$e['id']] = $e;
    }
    foreach ($expensesToArchive as $e) {
        if (isset($e['id'])) $map[$e['id']] = $e;
    }

    $merged = array_values($map);
    @file_put_contents($archiveFile, json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    echo json_encode([
        'success' => true,
        'archivedCount' => count($merged),
        'savedAt' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
