<?php
/**
 * Backups Management for Hostinger / Apache / cPanel / PHP Hosting
 * Handles local server backups and direct pCloud upload
 */

@error_reporting(0);
@ini_set('display_errors', '0');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: *');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['status' => 'ok']);
    exit(0);
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    $dataDir = sys_get_temp_dir() . '/skyarc_hostinger_data';
}
$backupsDir = $dataDir . '/backups';
if (!is_dir($backupsDir)) {
    @mkdir($backupsDir, 0775, true);
}
$dailyDir = $backupsDir . '/daily';
if (!is_dir($dailyDir)) {
    @mkdir($dailyDir, 0775, true);
}
$stateFile = $dataDir . '/system_state.json';
if (!file_exists($stateFile)) {
    $alt = __DIR__ . '/system_state.json';
    if (file_exists($alt)) $stateFile = $alt;
}

function extractCodeFromInput($input) {
    if (!$input) return '';
    $trimmed = trim($input);
    if (strpos($trimmed, 'http://') === 0 || strpos($trimmed, 'https://') === 0) {
        $parts = parse_url($trimmed);
        if (!empty($parts['query'])) {
            parse_str($parts['query'], $query);
            if (!empty($query['code'])) return trim($query['code']);
        }
        if (!empty($parts['fragment'])) {
            if (preg_match('/[?&]code=([a-zA-Z0-9_-]+)/i', $parts['fragment'], $m)) {
                return trim($m[1]);
            }
        }
        if (!empty($parts['path'])) {
            $segs = array_values(array_filter(explode('/', $parts['path'])));
            if (count($segs) > 0) {
                $last = end($segs);
                if ($last !== 'show' && $last !== 'upload' && $last !== 'publink' && strlen($last) >= 6) {
                    return trim($last);
                }
            }
        }
    }
    if (preg_match('/[?&#]code=([a-zA-Z0-9_-]+)/i', $trimmed, $m)) {
        return trim($m[1]);
    }
    return $trimmed;
}

function uploadFileToPCloudLinkPHP($code, $fileName, $content) {
    foreach (['us' => 'https://api.pcloud.com', 'eu' => 'https://eapi.pcloud.com'] as $reg => $base) {
        $tempFile = tempnam(sys_get_temp_dir(), 'pcl_');
        file_put_contents($tempFile, $content);

        $ch = curl_init();
        $cFile = new CURLFile($tempFile, 'application/octet-stream', $fileName);
        $postData = ['file' => $cFile, 'names' => 'SIC_Auto_Backup'];

        curl_setopt($ch, CURLOPT_URL, "$base/uploadtolink?code=" . urlencode($code) . "&names=SIC_Auto_Backup");
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_USERAGENT, 'SIC-Expenses-App/1.0');
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        @unlink($tempFile);

        if ($httpCode == 200 && $res) {
            $json = json_decode($res, true);
            if (isset($json['result']) && $json['result'] === 0) {
                return ['success' => true, 'region' => $reg, 'data' => $json];
            }
        }
    }
    return ['success' => false, 'error' => 'Failed uploading to pCloud'];
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: [];

// Detect action from URI if not in query
$reqUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
if (!$action) {
    if (strpos($reqUri, 'upload-pcloud') !== false) {
        $action = 'upload-pcloud';
    } elseif (strpos($reqUri, 'run-daily') !== false || strpos($reqUri, 'send-daily-email') !== false) {
        $action = 'run-daily';
    } elseif (strpos($reqUri, 'daily-status') !== false) {
        $action = 'daily-status';
    }
}

// 1. Action: daily-status
if ($action === 'daily-status') {
    $statusFile = $dailyDir . '/daily_backup_status.json';
    if (file_exists($statusFile)) {
        $status = json_decode(file_get_contents($statusFile), true);
        echo json_encode(['success' => true, 'status' => $status], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['success' => true, 'status' => null], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// 2. Action: upload-pcloud OR run-daily
if ($action === 'upload-pcloud' || $action === 'run-daily') {
    $link = isset($body['link']) ? $body['link'] : (isset($body['pcloudUrl']) ? $body['pcloudUrl'] : '');
    $fullState = isset($body['fullState']) ? $body['fullState'] : (isset($body['data']) ? $body['data'] : null);

    if (!$fullState && file_exists($stateFile)) {
        $fullState = json_decode(file_get_contents($stateFile), true);
    }
    if (!$fullState) $fullState = ['expenses' => [], 'projects' => [], 'custodies' => []];

    $dateStr = date('Y-m-d');
    $jsonFileName = "نسخة_احتياطية_كاملة_{$dateStr}.json";
    $jsonString = json_encode($fullState, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    // Save locally to daily backups
    $destJson = $dailyDir . '/' . $jsonFileName;
    @file_put_contents($destJson, $jsonString);
    @file_put_contents($dailyDir . '/latest_daily_backup.json', $jsonString);

    $pcloudUploaded = false;
    $uploadedFiles = [];
    $pcloudCode = extractCodeFromInput($link);

    if ($pcloudCode) {
        $uploadRes = uploadFileToPCloudLinkPHP($pcloudCode, $jsonFileName, $jsonString);
        if ($uploadRes['success']) {
            $pcloudUploaded = true;
            $uploadedFiles[] = $jsonFileName;
        }
    }

    $statusData = [
        'lastBackupDate' => $dateStr,
        'lastBackupTime' => date('c'),
        'pcloudUploaded' => $pcloudUploaded,
        'pcloudFiles' => $uploadedFiles,
        'jsonFileName' => $jsonFileName,
        'jsonSizeKb' => round(strlen($jsonString) / 1024, 2)
    ];
    @file_put_contents($dailyDir . '/daily_backup_status.json', json_encode($statusData, JSON_PRETTY_PRINT));

    echo json_encode([
        'success' => true,
        'pcloudUploaded' => $pcloudUploaded,
        'uploadedFiles' => $uploadedFiles,
        'dateStr' => $dateStr,
        'jsonFileName' => $jsonFileName,
        'jsonSizeKb' => round(strlen($jsonString) / 1024, 2),
        'message' => $pcloudUploaded
            ? "تم بنجاح حفظ النسخة الاحتياطية على السيرفر ورفعها إلى مجلد pCloud السحابي الخاص بك!"
            : "تم حفظ النسخة الاحتياطية اليومية بنجاح على السيرفر."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. Create manual backup (POST)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!file_exists($stateFile)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No state file exists to back up'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $label = isset($body['label']) ? preg_replace('/[^a-zA-Z0-9_\-]/', '_', $body['label']) : 'manual';
    $backupName = 'backup_' . $label . '_' . date('Y-m-d_H-i-s') . '.json';
    $dest = $backupsDir . '/' . $backupName;

    if (@copy($stateFile, $dest)) {
        echo json_encode([
            'success' => true,
            'backupFile' => $backupName,
            'createdAt' => date('c'),
            'sizeKb' => round(filesize($dest) / 1024, 2)
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to copy state file to backup'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// 4. List backups (GET)
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
