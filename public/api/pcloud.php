<?php
/**
 * pCloud Integration Handler for PHP / Apache / Hostinger / cPanel Hosting
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

function extractPCloudCode($input) {
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

function pcloudCurlGet($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'SIC-Expenses-App/1.0');
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$httpCode, $res];
}

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: [];
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Also check REQUEST_URI for subpaths like /api/pcloud/test-upload-link
$reqUri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
if (!$action) {
    if (strpos($reqUri, 'test-upload-link') !== false) {
        $action = 'test-upload-link';
    } elseif (strpos($reqUri, 'test-link') !== false) {
        $action = 'test-link';
    } elseif (strpos($reqUri, 'list-folder') !== false) {
        $action = 'list-folder';
    }
}

$link = isset($body['link']) ? $body['link'] : (isset($_GET['link']) ? $_GET['link'] : '');

// 1. Action: test-upload-link (File Request / طلب ملفات)
if ($action === 'test-upload-link') {
    if (!$link) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'يرجى إدخال رابط مجلد pCloud'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $code = extractPCloudCode($link);
    if (!$code) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'الرابط لا يحتوي على كود pCloud صالح'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Check US then EU for showuploadlink
    foreach (['us' => 'https://api.pcloud.com', 'eu' => 'https://eapi.pcloud.com'] as $reg => $base) {
        list($codeNum, $res) = pcloudCurlGet("$base/showuploadlink?code=" . urlencode($code));
        if ($codeNum == 200 && $res) {
            $json = json_decode($res, true);
            if (isset($json['result']) && $json['result'] === 0) {
                $folderName = !empty($json['name']) ? $json['name'] : (!empty($json['mail']) ? $json['mail'] : 'مجلد pCloud (طلب ملفات)');
                echo json_encode([
                    'success' => true,
                    'isUploadLink' => true,
                    'isPubLink' => false,
                    'folderName' => $folderName,
                    'region' => $reg,
                    'code' => $code,
                    'message' => "تم التحقق بنجاح! الرابط صالح لطلب الملفات (Request files) في مجلد: $folderName"
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
    }

    // Check if it's a PubLink (Read-only share link)
    foreach (['us' => 'https://api.pcloud.com', 'eu' => 'https://eapi.pcloud.com'] as $reg => $base) {
        list($codeNum, $res) = pcloudCurlGet("$base/showpublink?code=" . urlencode($code));
        if ($codeNum == 200 && $res) {
            $json = json_decode($res, true);
            if (isset($json['result']) && $json['result'] === 0 && !empty($json['metadata'])) {
                $meta = $json['metadata'];
                $folderName = !empty($meta['name']) ? $meta['name'] : 'مجلد مشاركة';
                echo json_encode([
                    'success' => true,
                    'isUploadLink' => false,
                    'isPubLink' => true,
                    'folderName' => $folderName,
                    'region' => $reg,
                    'code' => $code,
                    'message' => "هذا الرابط هو رابط مشاركة للعرض والتنزيل فقط (Share link) لمجلد \"$folderName\". pCloud يمنع الرفع عبر روابط المشاركة لحماية المجلد. يرجى اختيار \"Request files (طلب ملفات)\" بدلاً من Share link."
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'تعذر التحقق من رابط pCloud. تأكد من صحة الرابط وأنه رابط طلب ملفات (File Request).'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. Action: test-link (Public Share Folder)
if ($action === 'test-link') {
    $code = extractPCloudCode($link);
    foreach (['us' => 'https://api.pcloud.com', 'eu' => 'https://eapi.pcloud.com'] as $reg => $base) {
        list($codeNum, $res) = pcloudCurlGet("$base/showpublink?code=" . urlencode($code));
        if ($codeNum == 200 && $res) {
            $json = json_decode($res, true);
            if (isset($json['result']) && $json['result'] === 0) {
                echo json_encode([
                    'success' => true,
                    'region' => $reg,
                    'folderName' => $json['metadata']['name'] ?? 'مجلد مشاركة',
                    'message' => 'تم التحقق بنجاح!'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'تعذر قراءة المجلد من pCloud'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['success' => true, 'service' => 'pCloud PHP Gateway']);
