<?php
/**
 * PROXY PHP para Servidores Tradicionales
 * Copia este archivo a tu servidor como 'proxy.php'
 * y actualiza la constante PROXY_URL en app.js
 */

// Permitir peticiones desde cualquier origen (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, api-key, env");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Leer el JSON recibido
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || !isset($data['url'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Petición malformada"]);
    exit;
}

$targetUrl = $data['url'];
$headers = $data['headers'] ?? [];
$body = $data['body'] ?? [];

// Preparar Headers para CURL
$curlHeaders = ['Content-Type: application/json'];
foreach ($headers as $key => $value) {
    if (strtolower($key) !== 'content-type') {
        $curlHeaders[] = "$key: $value";
    }
}

// Iniciar CURL
$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Opcional: Desactivar si hay problemas de SSL en el servidor

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "CURL Error: $error"]);
} else {
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo $response;
}
?>
