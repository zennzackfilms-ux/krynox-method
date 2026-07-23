<?php
/**
 * Krynox x Zenn Method — Process itzStream Link
 */

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$url = $input['url'] ?? '';
$encode = !empty($input['encode']);

if (!preg_match('#video\.itzcrih\.it/v/([a-f0-9]+)#i', $url, $m)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid itzStream URL format']);
    exit;
}

try {
    // Download from itzStream
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_MAXFILESIZE => 500 * 1024 * 1024,
        CURLOPT_USERAGENT => 'KrynoxMethod/1.0',
    ]);
    $videoData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$videoData) {
        throw new Exception('Failed to fetch from itzStream');
    }

    $inputPath = __DIR__ . '/uploads/' . uniqid('link_', true) . '.mp4';
    file_put_contents($inputPath, $videoData);

    $outputName = uniqid('out_', true) . '.mp4';
    $outputPath = __DIR__ . '/processed/' . $outputName;

    $metadata = '-metadata:s:v:0 "encoder=KrynoxOptimizer" -metadata:s:a:0 "encoder=KrynoxAudio"';

    if ($encode) {
        $cmd = sprintf(
            'ffmpeg -i %s -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -y %s 2>&1',
            escapeshellarg($inputPath),
            escapeshellarg($outputPath)
        );
    } else {
        $cmd = sprintf(
            'ffmpeg -i %s -c copy -map 0 %s -movflags +faststart -y %s 2>&1',
            escapeshellarg($inputPath),
            $metadata,
            escapeshellarg($outputPath)
        );
    }

    exec($cmd, $output, $exitCode);
    @unlink($inputPath);

    if ($exitCode !== 0 || !file_exists($outputPath)) {
        throw new Exception('Processing failed');
    }

    echo json_encode([
        'url' => '/download.php?file=' . $outputName,
        'filename' => 'stream-video.mp4'
    ]);

} catch (Exception $e) {
    if (isset($inputPath)) @unlink($inputPath);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
