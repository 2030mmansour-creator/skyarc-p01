<?php
/**
 * SkyArc Active Session Registration & Single-Device Enforcement API for PHP
 */
@error_reporting(0);
@ini_set('display_errors', '0');

if (!ob_get_level()) {
    ob_start();
} else {
    ob_clean();
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: *');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['status' => 'ok']);
    exit(0);
}

function getSessionsFilePath() {
    $dir = __DIR__;
    $dataDir = $dir . '/data';
    if (!is_dir($dataDir)) {
        @mkdir($dataDir, 0775, true);
    }
    return $dataDir . '/active_user_sessions.json';
}

function loadSessions() {
    $path = getSessionsFilePath();
    if (file_exists($path)) {
        $raw = @file_get_contents($path);
        if ($raw) {
            $data = json_decode($raw, true);
            if (is_array($data)) return $data;
        }
    }
    return [];
}

function saveSessions($sessions) {
    $path = getSessionsFilePath();
    $raw = json_encode($sessions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    @file_put_contents($path, $raw, LOCK_EX);
}

// ----------------------------------------------------
// GET: Check session validity or get active session
// ----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $headers = getallheaders();
    $userId = isset($_GET['userId']) ? $_GET['userId'] : (isset($headers['X-User-Id']) ? $headers['X-User-Id'] : (isset($headers['x-user-id']) ? $headers['x-user-id'] : ''));
    $sessionId = isset($_GET['sessionId']) ? $_GET['sessionId'] : (isset($headers['X-Session-Id']) ? $headers['X-Session-Id'] : (isset($headers['x-session-id']) ? $headers['x-session-id'] : ''));

    $sessions = loadSessions();

    if (empty($userId)) {
        ob_clean();
        echo json_encode([
            'success' => true,
            'activeSessions' => $sessions
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!isset($sessions[$userId])) {
        ob_clean();
        echo json_encode([
            'success' => true,
            'isCurrentSessionActive' => true,
            'sessionEvicted' => false,
            'activeSession' => null
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $currentActive = $sessions[$userId];
    $activeId = isset($currentActive['activeSessionId']) ? $currentActive['activeSessionId'] : '';

    if (!empty($sessionId) && !empty($activeId) && $activeId !== $sessionId) {
        ob_clean();
        echo json_encode([
            'success' => true,
            'isCurrentSessionActive' => false,
            'sessionEvicted' => true,
            'activeSessionId' => $activeId,
            'activeSession' => $currentActive
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    ob_clean();
    echo json_encode([
        'success' => true,
        'isCurrentSessionActive' => true,
        'sessionEvicted' => false,
        'activeSessionId' => $activeId,
        'activeSession' => $currentActive
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------
// POST: Register active user session
// ----------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    if (empty($rawInput) && !empty($_POST['data'])) {
        $rawInput = $_POST['data'];
    }

    $payload = json_decode($rawInput, true);
    if (!is_array($payload)) {
        $payload = $_POST;
    }

    $userId = isset($payload['userId']) ? $payload['userId'] : '';
    $sessionId = isset($payload['sessionId']) ? $payload['sessionId'] : (isset($payload['activeSessionId']) ? $payload['activeSessionId'] : '');
    $userName = isset($payload['userName']) ? $payload['userName'] : 'مستخدم النظام';
    $device = isset($payload['device']) ? $payload['device'] : 'متصفح ويب';
    $loginTime = isset($payload['loginTime']) ? $payload['loginTime'] : date('c');

    if (empty($userId) || empty($sessionId)) {
        ob_clean();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing userId or sessionId'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sessions = loadSessions();
    $nowIso = date('c');

    $sessions[$userId] = [
        'userId' => $userId,
        'activeSessionId' => $sessionId,
        'userName' => $userName,
        'device' => $device,
        'loginTime' => $loginTime,
        'lastSeenAt' => $nowIso
    ];

    saveSessions($sessions);

    ob_clean();
    echo json_encode([
        'success' => true,
        'activeSession' => $sessions[$userId]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

ob_clean();
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
