<?php
/**
 * Krynox x Zenn Method — File Download
 */

header('Content-Type: application/json');

$file = isset($_GET['file']) ? basename($_GET['file']) : '';
$filepath = __DIR__ . '/processed/' . $file;

if (!$file || !file_exists($filepath)) {
    http_response_code(404);
    echo json_encode(['error' => 'File not found']);
    exit;
}

$ext = strtolower(pathinfo($filepath, PATHINFO_EXTENSION));
$mimeMap = [
    'mp4' => 'video/mp4',
    'mov' => 'video/quicktime',
    'm4v' => 'video/x-m4v',
];
$mime = $mimeMap[$ext] ?? 'application/octet-stream';

header('Content-Type: ' . $mime);
header('Content-Disposition: attachment; filename="' . $file . '"');
header('Content-Length: ' . filesize($filepath));
header('Cache-Control: no-cache');
readfile($filepath);
