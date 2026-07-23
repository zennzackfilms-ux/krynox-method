<?php
/**
 * Krynox x Zenn Method — TikTok Quality Preserver
 * PHP Backend for Namecheap Stellar hosting
 * 
 * Requires: FFmpeg installed on server (check with your host)
 * 
 * Upload flow:
 *   POST /process.php
 *   - video: file upload
 *   - encode: "1" or "0"
 *   Returns: JSON with download URL
 */

// Config
define('MAX_SIZE', 500 * 1024 * 1024);
define('UPLOAD_DIR', __DIR__ . '/uploads');
define('PROCESSED_DIR', __DIR__ . '/processed');
define('FFMPEG_PATH', 'ffmpeg'); // Change if ffmpeg is at a custom path

foreach ([UPLOAD_DIR, PROCESSED_DIR] as $dir) {
    if (!is_dir($dir)) mkdir($dir, 0755, true);
}

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

try {
    $encode = isset($_POST['encode']) && $_POST['encode'] === '1';

    if (!isset($_FILES['video']) || $_FILES['video']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('No file uploaded or upload error');
    }

    $file = $_FILES['video'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['mp4', 'mov', 'm4v'])) {
        throw new Exception('Only MP4, MOV, M4V files allowed');
    }

    if ($file['size'] > MAX_SIZE) {
        throw new Exception('File exceeds 500MB limit');
    }

    // Generate unique filenames
    $inputName = uniqid('in_', true) . '.' . $ext;
    $inputPath = UPLOAD_DIR . '/' . $inputName;

    if (!move_uploaded_file($file['tmp_name'], $inputPath)) {
        throw new Exception('Failed to save upload');
    }

    $outputName = uniqid('out_', true) . '.mp4';
    $outputPath = PROCESSED_DIR . '/' . $outputName;

    if ($encode) {
        // Full re-encode
        $cmd = sprintf(
            '%s -i %s -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -y %s 2>&1',
            escapeshellcmd(FFMPEG_PATH),
            escapeshellarg($inputPath),
            escapeshellarg($outputPath)
        );
    } else {
        // Quick patch: copy video + modify metadata
        $metadata = '-metadata:s:v:0 "encoder=KrynoxOptimizer" -metadata:s:a:0 "encoder=KrynoxAudio"';

        // For the quick patch, we use ffmpeg to remux (no re-encode) while adding metadata
        $cmd = sprintf(
            '%s -i %s -c copy -map 0 %s -movflags +faststart -y %s 2>&1',
            escapeshellcmd(FFMPEG_PATH),
            escapeshellarg($inputPath),
            $metadata,
            escapeshellarg($outputPath)
        );
    }

    exec($cmd, $output, $exitCode);

    // Cleanup input
    @unlink($inputPath);

    if ($exitCode !== 0 || !file_exists($outputPath)) {
        throw new Exception('Processing failed: ' . implode("\n", array_slice($output, -5)));
    }

    // Schedule cleanup for old files
    $cleanupPct = 0.1; // delete 10% of oldest files if over 100
    $files = glob(PROCESSED_DIR . '/*');
    if (count($files) > 100) {
        usort($files, function($a, $b) { return filemtime($a) - filemtime($b); });
        $toDelete = array_slice($files, 0, (int)(count($files) * $cleanupPct));
        foreach ($toDelete as $f) @unlink($f);
    }

    echo json_encode([
        'url' => '/download.php?file=' . $outputName,
        'filename' => $file['name']
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
