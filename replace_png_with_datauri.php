<?php

$pngs = [
	'random32.png',
	'advanced_security32.png',
	'trash32.png',
	'handshakeB32.png',
];
$data_uris = [];
foreach ($pngs as $png) {
	$data_uris[] = 'data:image/png;base64,'. base64_encode(file_get_contents($png));
}
$text = file_get_contents('php://stdin');
$text = str_replace($pngs, $data_uris, $text);
print $text;
