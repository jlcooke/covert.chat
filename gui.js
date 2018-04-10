'use strict';
/*
 * covert.chat gui.js - GUI and glue
 * Copyright Jean-Luc Cooke 2018
 */

function gel(id) { return document.getElementById(id); }
function hide(id) { ((typeof id == 'string') ?gel(id) :id) .style.display = 'none'; }
function toggle(id) {
	var els = gel(id).style;
	return els.display = (els.display == 'none')
		?'block'
		:'none';
}
function show(id,type) { ((typeof id == 'string') ?gel(id) :id) .style.display = type ?type :'block'; }
function log(msg) {
	gel('log').innerHTML += (new Date()) +': '+ msg +'\n';
}
function _time() { return (new Date()).getTime(); }
var UA = navigator.userAgent,
	isMobile = UA .match(/Mobile/) ?1:0,
	isIOS = UA .match(/(iPhone|iPod|iPad)/) ?1:0,
	isMacOS = UA .match(/(iPhone|iPod|iPad|Mac OS)/) ?1:0;

// don't store in cookies because they're transmitted to the server
// returns -1 if localStorage is not available
// returns -2 if localStorage is disabled
function localStore(key,val) {
	// don't have localStorage than give up
	if (typeof(Storage) == 'undefined') {
		log('typeof(Storage) is undefined - no localStorage available');
		return -1;
	}

	log('Storing in browser localStorage (cookies are not safe): '+ key +' = '+ val);
	try {
		localStorage.setItem(key, val);
		return 0;
	} catch(e) {
		log('[ERROR] Could not localStore('+key+') - localStorage disabled?');
		return -2;
	}
}
// don't store in cookies because they're transmitted to the server
function localFetch(key) {
	// don't have localStorage than give up
	if (typeof(Storage) == 'undefined') {
		log('typeof(Storage) is undefined - no localStorage available');
		return null;
	}

	log('Fetching from localStorage (cookies are not safe): '+ key);
	try {
		return localStorage.getItem(key);
	} catch(e) {
		log('[ERROR] Could not localFetch('+key+') - localStorage disabled?');
		return null;
	}
}

function cleanPhone(num) {
	if (num.match(/@/)) {
		return num.replace(/(^\s+|\s+$)/g,'');
	}
	return num.replace(/[^0-9]/g,'');
}

var strlib = new Strlib(),
	sha256 = new SHA256JS(),
	aes256 = new AESJS(),
	dh = new DH(),
	addressbook = {},
	cryptIntervalID = 0;

var entpool = {
	events: {},
	count: 0,
	len: 0,
	str: _time()
};
function entpoolAddEvent(e) {
	// null event
	if (!e.pageX && !e.pageY)
		return;

	if (!entpool.events[e.type]) {
		entpool.events[e.type] = 1;
		log('Collecting '+ e.type +' events for randomness.');
	}

	var str = e.type +':'+ _time() +':'+ e.pageX +','+ e.pageY +'; ';
	entpool.count++;
	entpool.len += str.length;
	entpool.str += str;

	if (updateEntPool.count) {
		updateEntPool.cb(--updateEntPool.count);
	}
}
function updateEntPool() {
	var now = _time();
	if (!updateEntPool.last)
		updateEntPool.last = now;
	var diff = now - updateEntPool.last,
		str = 'update:'+ diff +'; ';
	updateEntPool.last = now;

	entpool.count++;
	entpool.len += str.length;
	entpool.str += str;

	if (!updateEntPool.count  &&  entpool.str.length > 1024) {
		gel('entpool_status').innerHTML = '## Entropy & Random Number Generator ##\n'+
			'Entropy Pool accumulator length is '+ entpool.str.length +' - compressing with SHA256\n'+
			'Event Counter: '+ entpool.count +'\n'+
			'Total Accumulated bytes: '+ entpool.len +'\n';
		var sha256 = new SHA256JS();
		entpool.str = strlib.base64FromInts( sha256.hashStr(entpool.str) ) +'; ';
	}
}
setInterval(updateEntPool, 100);

function watcherLoop() {
	var myphonenum = gel('myphonenum').value,
		pass = gel('passphrase').value,
		plain = gel('plaintext').value,
		key = myphonenum +'\t'+ pass +'\t'+ plain;

	gel('error').innerHTML = '';
	if (pass.length > 20) {
		hide('sendDHHandshake');
		hide('genPass');
	} else {
		show('sendDHHandshake');
		show('genPass','inline-block');
	}

	if (watcherLoop.last != key) {
		if (location.href.match(/#c=/)  &&  !decryptMessage.done) {
			decryptMessage(pass);
		} else {
			encryptMessage(pass);
			watcherLoop.last = key;
		}
	}
}

function phonenumBlur(el) {
	gel('passphrase').value = addressbookFetch(el.value).pass || '';
}
function encryptMessage(pass) {
	var phone = cleanPhone(gel('phonenum').value),
		plain = gel('plaintext').value,
		CT = encryptMessageString(pass, plain);
	encryptMessage.lastiv = CT.iv;

	if (showChatHistory.last != phone) {
		showChatHistory(phone, addressbookFetch(phone));
	}

	if (pass == '') {
		return gel('ciphertext').innerHTML = _T('Passphrase missing');
	}

	// encode phonenumber in base64 (1-905-555-1212
	// var n = strlib.base64FromInts([1* gel('myphonenum').value.replace(/[^0-9]/g,'')]).replace(/=/g,'');

	var el,
		urlpre = 'https://covert.chat/#c='+ cleanPhone(gel('myphonenum').value) +',', // need 'covert.chat/#c=' instead of 'covert.chat#c' for Android
		phonetxt = '<span dir="ltr">'+ phone +'</span>'; // needed for Right-to-Left languages

	if (el = gel('sendButtonText-1')) el.innerHTML = el.innerHTML .replace(/: .*/, ': '+phonetxt);
	if (el = gel('sendButtonText-2')) el.innerHTML = el.innerHTML .replace(/: .*/, ': '+phonetxt);

	gel('sendButton').setAttribute('uri',
		'sms:'+ phone +(isMacOS ?'&' :'?') +'body='+ encodeURIComponent(urlpre) + CT.ivct
	);

	var msg = urlpre + CT.ivct;
	gel('ciphertext').innerHTML = msg;
	gel('ciphertext_len').innerHTML = msg.length;
}
function encryptMessageString(pass, plain) {
	var sha256 = new SHA256JS(),
		iv = sha256.hashStr( entpool.str );
	// we set the first int in the IV to the unixtime to we can sequnce
	// conversations (is the user stores message history).
	// Security model of CTR depends on IVs never being re-used (we have 96 more bits for that)
	iv[0] = Math.floor(_time()/1000);
	iv = strlib.bytesFromInts(iv) .splice(0,16); // iv is blocksize (16 bytes)

	var key = strlib.bytesFromInts(sha256.hmacStr(strlib.base64FromBytes(iv), pass));
	// TODO - maybe do 1000 iterations of key=HMAC(iv,key) to increase computational diff?

	var aes256ctr = new aes256.ModeOfOperation.ctr(key, iv);

	// for confirmation of decryption - first two bytes are zero-bytes
	var ct = aes256ctr.encrypt( strlib.utf8ToBytes( '\x00\x00'+ plain ) ),
		ivct = iv.concat( Array.from(ct) );
	ivct = strlib.base64FromBytes(ivct) .replace(/=/g,'');

	return {
		iv: iv,
		ct: ct,
		ivct: ivct
	};
}

function decryptMessage(pass) {
	var ivct = strlib.base64ToBytes( gel('ciphertext').innerHTML ),
		sha256 = new SHA256JS(),
		ct = ivct,
		iv = ct.splice(0,16), // iv is blocksize (16 bytes), ct holds the rest
		key = strlib.bytesFromInts(sha256.hmacStr(strlib.base64FromBytes(iv), pass));

	var aes256ctr = new aes256.ModeOfOperation.ctr(key, iv),
		dec = aes256ctr.decrypt( ct );

	// first 2 charactors should be zero
	if (dec[0] != 0  ||  dec[1] != 0) {
		gel('error').innerHTML = _T(
			(pass == '')
			?'Enter passphrase to decrypt and view message'
			:'Could not decrypt, enter correct passphrase'
		);
		show('passphrase-div');
		gel('passphrase').focus();
		return;
	}

	dec = strlib.utf8FromBytes(dec).substr(2);

	// update our addressbook and save it
	addressbookStore(gel('phonenum').value, pass, iv, {inp:dec});

	// hide the pass inputs and show the message
	hide('passphrase-div');
	show('your-message','inline-block');
	gel('error').innerHTML = '';
	addChatHistoryBubble('in', iv, dec);

	decryptMessage.done = 1;

	clearInterval(cryptIntervalID);
}

function toggleAdvanced() { toggle('advanced'); }
function toggleLog() {
	var disp = toggle('log');

	gel('debug').style.display =
		gel('entpool_status').style.display =
		disp;
}

function addressbookFetch(addr) {
	return addressbook[addr]
		?addressbook[addr]
		:{ pass:'', hist:{inp:[],out:[]} };
}

function addressbookStore(addr, pass, iv, msg) {
	var A = addressbook[addr],
		ivtok;
	ivtok = iv ?strlib.bytesToInts(iv)[0] :null;

	// encode message and passphrase because it may have JSON-unsafe characters
	if (!A) A={};
	if (!A.hist) A.hist={ inp:[], out:[] };

	A.pass = pass;

	// build list of IV's used for in-coming messages
	var hist_in = {};
	for (var i in A.hist.inp) {
		var tm = A.hist.inp[i];
		hist_in[ tm.substr(0,tm.indexOf(':')) ] = 1;
	}
	// build list of IV's used for out-going messages
	var hist_out = {};
	for (var i in A.hist.out) {
		var tm = A.hist.out[i];
		hist_out[ tm.substr(0,tm.indexOf(':')) ] = 1;
	}

	// only add to history is we've never seen this message before
	if (msg  &&  msg.inp  &&  !hist_in[ivtok])
		A.hist.inp.push( ivtok +':'+ msg.inp );
	if (msg  &&  msg.out  &&  !hist_out[ivtok])
		A.hist.out.push( ivtok +':'+ msg.out );

	A.hist.inp = A.hist.inp.slice(-10);
	A.hist.out = A.hist.out.slice(-10);

	addressbook[addr] = A;
	localStore('addrbook', JSON.stringify(addressbook));
}

function composeMessage(){
	hide('replyButton');
	show('to-replyto');
	show('passphrase-div');
	show('compose-message');

	cryptIntervalID = setInterval(watcherLoop, 500);
}

function genPass() {
	var sha256 = new SHA256JS(),
		str = strlib.base64FromInts(sha256.hashStr( entpool.str ));
	gel('passphrase').value = str.substr(0,12);
}
function showMessage(){
	cryptIntervalID = setInterval(watcherLoop, 500);
}

function sendMessage() {
	var phone = gel('phonenum').value,
		pass = gel('passphrase').value,
		uri = gel('sendButton').getAttribute('uri');
	if (pass == '')
		return;

	addressbookStore(phone, pass, encryptMessage.lastiv, {out:gel('plaintext').value});
	localStore('myphonenum', cleanPhone(gel('myphonenum').value));
	localStore('phonenum', phone);

	if (phone.match(/@/)  &&  confirm(_T('The To phone number you entered is an email address, send as email instead?'))) {
		uri = uri.replace(/^sms:(.*?)(&|\?)/, 'mailto:\x01?subject=covert.chat%20txt&');
	}
	location.href = uri;
}

function addChatHistoryBubble(type, iv, txt) {
	var ivtok = strlib.bytesToInts(iv);
	ivtok = ivtok[0];
	if (showChatHistory.times.includes(ivtok))
		return;

	gel('history').innerHTML += makeChatHistoryBubble(type, txt);
}
function makeChatHistoryBubble(type, txt) {
	var id = '',
		style = 'display:inline-block; padding:4px; margin:2px 4px 2px 4px; '+
			'-webkit-border-radius:5px; border-radius:5px; border:1px solid black; '+
			'-webkit-box-shadow:2px 2px 10px 0px #616161; box-shadow:2px 2px 7px 0px #616161; ';

	if (type == 'in-new') {
		type = 'in';
		txt = '<b>'+ txt +'</b>';
	}

	style += (type=='in')
		?'float:left;  background:lightblue; '
		:'float:right; background:lightgreen;';

	return '<div style="display:block; clear:right;"><div style="'+ style +'">'+ txt +'</div></div>\n';
}
function showChatHistory(addr, A) {
	var html = '',
		line = {},
		times = [];

	if (A.hist.inp.length  ||  A.hist.out.length) {
		for (var i in A.hist.inp) {
			var tm = A.hist.inp[i],
				tmi = tm.indexOf(':');
			tm = [ tm.substr(0,tmi), tm.substr(tmi+1) ];
			times.push(tm[0]*1);
			line[tm[0]] = { inp:tm[1] };
		}
		for (var i in A.hist.out) {
			var tm = A.hist.out[i],
				tmi = tm.indexOf(':');
			tm = [ tm.substr(0,tmi), tm.substr(tmi+1) ];
			var L = line[tm[0]];
			if (!L) {
				L = {};
				times.push(tm[0]*1);
			}
			L.out = tm[1];
			line[tm[0]] = L;
		}
		times.sort();

		for (var t in times) {
			var L = line[times[t]];
			if (L.inp) html += makeChatHistoryBubble('in', L.inp);
			if (L.out) html += makeChatHistoryBubble('out', L.out);
			html += '<br/>\n';
		}
	}

	gel('history').innerHTML = html;
	showChatHistory.times = times;
	showChatHistory.last = addr;
}

//////

function retranslateDocument(lang) {
	location.href = location.href.replace(/#.*/,'') +'#l='+lang;
	localStore('lang', lang);
	clearInterval(cryptIntervalID);
	window.onload();
	return false;
}
function translateDocument() {
	if (_T.lang == 'en')
		return;

	var i,
		html = document.body.innerHTML;
	for (i=0; i<_T.dict.en.length; i++) {
		if (_T.dict.en[i] == _T.dict[_T.lang][i])
			continue;
		while (html.indexOf(_T.dict.en[i]) != -1) {
			html = html.replace(_T.dict.en[i], _T.dict[_T.lang][i]);
		}
	}
	document.body.innerHTML = html;
}
function _T(str) {
	if (_T.lang == 'en')
		return str;

	var i;
	for (i=0; i<_T.dict.en.length; i++) {
		if (_T.dict.en[i] == str)
			return _T.dict[_T.lang][i];
	}

	log('No '+ _T.lang +' translation found for '+ str);
	return str;
}

_T.dict = {
	en:[
		'Transparent Encrypted Messaging',
		'Reply-To',
		'To ',
		'Reply',
		'Generate Random Passphrase',
		'Your message goes here',
		'Encrypted Message',
		'Length',
		'Send Message to',
		'Show console',
		'Passphrase missing',
		'Enter passphrase to decrypt and view message',
		'Could not decrypt, enter correct passphrase',
		'Passphrase',
		'Download',
		'Apple iPhone/iPad/iPod should use "Add to Reading List" found in the "Share Arrow" button at the bottom of the screen.',
		'The To phone number you entered is an email address, send as email instead?',
		'Warning\n\nYou are using this from a non-mobile browser.  SMS messaging (usually) only works from a mobile phone.',
		'Erase All Data',
		'Send Diffie-Hellman handshake',
		'This will erase saved messages, addressbook and passwords.  Continue?'
	],
	fr:[
		'Messagerie cryptée transparente',
		'Répondre à',
		'À',
		'Répondre',
		'Générer une phrase secrète aléatoire',
		'Votre message va ici',
		'Message chiffré',
		'Longueur',
		'Envoyer un message à',
		'Afficher la console',
		'Phrase de passe manquante',
		'Entrez le mot de passe pour déchiffrer et afficher le message.',
		'Impossible de déchiffrer, entrez la phrase secrète correcte',
		'phrase secrète',
		'Télécharger',
		'Apple iPhone / iPad / iPod devrait utiliser "Ajouter à la liste de lecture" dans le bouton "Partager la flèche" au bas de l\'écran',
		'Le numéro de téléphone que vous avez entré est une adresse e-mail, envoyer par e-mail à la place?',
		'Attention\n\nVous l\'utilisez à partir d\'un navigateur non mobile. La messagerie SMS (généralement) ne fonctionne que depuis un téléphone portable.',
		'Effacer toutes les données',
		'Envoyer une poignée de main Diffie-Hellman',
		'Cela effacera les messages enregistrés, le carnet d\'adresses et les mots de passe. Continuer?'
	],
	de:[
		'Transparente verschlüsselte Nachrichten',
		'Antwort an',
		'Zu',
		'Antworten',
		'Zufällige Passphrase generieren',
		'Deine Nachricht geht hierhin',
		'Verschlüsselte Nachricht',
		'Länge',
		'Nachricht senden an',
		'Konsole zeigen',
		'Passphrase fehlt',
		'Geben Sie die Passphrase ein, um die Nachricht zu entschlüsseln und anzuzeigen.',
		'Konnte nicht entschlüsseln, korrekte Passphrase eingeben',
		'Passphrase',
		'Herunterladen',
		'Apple iPhone / iPad / iPod sollte "Zur Leseliste hinzufügen" verwenden, die in der "Share Arrow" -Schaltfläche am unteren Bildschirmrand zu finden ist',
		'Die von Ihnen eingegebene Telefonnummer ist eine E-Mail-Adresse, senden Sie sie stattdessen als E-Mail?',
		'Warnung\n\nSie verwenden dies von einem nicht mobilen Browser aus. SMS funktionieren (normalerweise) nur von einem Mobiltelefon aus.',
		'Alle Daten löschen',
		'Senden Sie Diffie-Hellman handshake',
		'Dies löscht gespeicherte Nachrichten, Adressbuch und Passwörter. Fortsetzen?'
	],
	es:[
		'Transmisión de mensajes cifrados',
		'Responder a',
		'A',
		'Respuesta',
		'Generar frase de contraseña aleatoria',
		'Tu mensaje va aquí',
		'Mensaje encriptado',
		'Longitud',
		'Enviar mensaje ao',
		'Muestra la consola',
		'Frase de contraseña faltante',
		'Ingrese la frase de contraseña para descifrar y ver el mensaje.',
		'No se pudo descifrar, ingrese la frase de contraseña correcta',
		'frase de contraseña',
		'Descargar',
		'Apple iPhone / iPad / iPod debería usar "Agregar a la lista de lectura" que se encuentra en el botón "Compartir flecha" en la parte inferior de la pantalla',
		'¿El número de teléfono que ingresó es una dirección de correo electrónico, en su lugar, envíela como correo electrónico?',
		'Advertencia\n\nEstá utilizando esto desde un navegador que no es móvil. La mensajería SMS (por lo general) solo funciona desde un teléfono móvil.',
		'Borrar todos los datos',
		'Enviar el saludo de Diffie-Hellman',
		'Esto borrará los mensajes guardados, la libreta de direcciones y las contraseñas. ¿Continuar?'
	],
	kr:[
		'투명한 암호화 메시징',
		'답장하다',
		'에',
		'댓글',
		'랜덤 패스 프레이즈 생성',
		'귀하의 메시지는 여기에 있습니다.',
		'암호화 된 메시지',
		'길이',
		'님에게 쪽지 보내기',
		'콘솔 표시',
		'암호 문구가 누락되었습니다.',
		'암호를 해독하고보기 위해 암호를 입력하십시오.',
		'해독 할 수 없으며 올바른 암호를 입력 할 수 없습니다.',
		'암호문',
		'다운로드',
		'Apple iPhone / iPad / iPod는 화면 하단의 "공유 화살표"버튼에있는 "독서 목록에 추가"를 사용해야합니다.',
		'받는 사람 전화 번호가 전자 메일 주소이며 대신 전자 메일로 보내시겠습니까?',
		'경고\n\n 모바일이 아닌 브라우저에서 사용하고 있습니다. SMS 메시징 (일반적으로)은 휴대 전화에서만 작동합니다.',
		'모든 데이터 지우기',
		'Diffie-Hellman 핸드 셰이크를 보냅니다.',
		'이렇게하면 저장된 메시지, 주소록 및 비밀번호가 지워집니다. 잇다?'
	],
	cn:[
		'透明的加密消息',
		'回复',
		'至',
		'回复',
		'生成随机密码',
		'你的信息就在这里',
		'加密的消息',
		'长度',
		'发送消息给',
		'显示控制台',
		'密码短缺',
		'输入密码解密并查看消息',
		'无法解密，请输入正确的密码',
		'密码',
		'下载',
		'Apple iPhone / iPad / iPod应使用屏幕底部的"分享箭头"按钮中的"添加到阅读列表"',
		'您输入的电话号码是电子邮件地址，请以电子邮件的方式发送？',
		'警告\n\n您正在通过非移动浏览器使用此功能。 短信（通常）只能通过手机工作',
		'擦除所有数据',
		'发送Diffie-Hellman握手',
		'这将清除保存的信息，地址簿和密码。 继续？'
	],
	ru:[
		'Прозрачные зашифрованные сообщения',
		'Ответить на',
		'к',
		'Ответить',
		'Генерировать случайную парольную фразу',
		'Ваше сообщение здесь',
		'Зашифрованное сообщение',
		'длина',
		'Отправить сообщение для',
		'Показать консоль',
		'Пропущенная фраза',
		'Введите кодовую фразу для расшифровки и просмотра сообщения',
		'Не удалось расшифровать, ввести правильную кодовую фразу',
		'кодовая фраза',
		'Скачать',
		'Apple iPhone / iPad / iPod должен использовать «Добавить в список чтения», найденный в кнопке «Поделиться стрелкой» в нижней части экрана',
		'Введенный вами номер телефона - это адрес электронной почты, вместо этого отправьте его по электронной почте?',
		'Предупреждение\n\nВы используете это из не-мобильного браузера. Обмен сообщениями SMS (обычно) работает только с мобильного телефона',
		'Удалить все данные',
		'Отправить Diffie-Hellman рукопожатие',
		'Это приведет к удалению сохраненных сообщений, адресной книги и паролей. Продолжать?'
	],
	jp:[
		'透過的な暗号化メッセージング',
		'に返信',
		'に',
		'応答',
		'ランダムなパスフレーズを生成する',
		'あなたのメッセージはここに',
		'暗号化されたメッセージ',
		'長さ',
		'メッセージを送る',
		'コンソールを表示する',
		'パスフレーズがない',
		'復号化してメッセージを表示するパスフレーズを入力',
		'解読できず、正しいパスフレーズを入力できませんでした',
		'パスフレーズ',
		'ダウンロード',
		'Apple iPhone / iPad / iPodは、画面の下部にある[共有矢印]ボタンにある[読み上げリストに追加]を使用する必要があります',
		'入力したToの電話番号は電子メールアドレスです。代わりに電子メールで送信しますか？',
		'警告\n\nあなたはこれを非モバイルブラウザから使用しています。 SMSメッセージング（通常）は、携帯電話からのみ動作します',
		'すべてのデータを消去する',
		'Diffie-Hellmanハンドシェイクを送信する',
		'保存されたメッセージ、アドレス帳、パスワードが消去されます。 持続する？'
	],
	sa:[
		'رسائل مشفرة شفافة',
		'الرد على',
		'إلى',
		'الرد',
		'توليد كلمة مرور عشوائية',
		'رسالتك هنا',
		'رسالة مشفرة',
		'الطول',
		'إرسال رسالة إلى',
		'وحدة العرض',
		'عبارة المرور في عداد المفقودين',
		'أدخل عبارة المرور لفك تشفير وعرض الرسالة',
		'تعذر فك تشفير ، أدخل عبارة المرور الصحيحة',
		'عبارة المرور',
		'تحميل',
		'يجب أن يستخدم Apple iPhone / iPad / iPod "Add to Reading List" الموجود في زر "Share Arrow" في الجزء السفلي من الشاشة',
		'رقم الهاتف الذي أدخلته هو عنوان بريد إلكتروني ، أرسل كبريد إلكتروني بدلاً من ذلك؟',
		'تحذير\n\nأنت تستخدم هذا من متصفح غير متحرك. رسائل SMS (عادة) تعمل فقط من هاتف محمول.',
		'محو جميع البيانات',
		'إرسال مصافحة Diffie-Hellman',
		'سيؤدي ذلك إلى مسح الرسائل المحفوظة ودفتر العناوين وكلمات المرور. استمر؟'
	]
};

function downloadLocal() {
	if (!isIOS)
		return true;

	alert(_T('Apple iPhone/iPad/iPod should use "Add to Reading List" found in the "Share Arrow" button at the bottom of the screen.'));
	return false;
}

function clearAllLocalStorage() {
	if (confirm(_T('This will erase saved messages, addressbook and passwords.  Continue?'))) {
		log('Erasing all local data as requested.');
		localStorage.clear();
		alert('All gone.');
	}
}

/**
 * Used to append HTML to a webpage for this app
 * This is put here so it can be included via [script src="..." integrity="..."] for the paranoid
 */
function writePage() {
	var LANGS = {
		en:'iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAflJREFUeNpinDRzn5qN3uFDt16+YWBg+Pv339+KGN0rbVP+//2rW5tf0Hfy/2+mr99+yKpyOl3Ydt8njEWIn8f9zj639NC7j78eP//8739GVUUhNUNuhl8//ysKeZrJ/v7z10Zb2PTQTIY1XZO2Xmfad+f7XgkXxuUrVB6cjPVXef78JyMjA8PFuwyX7gAZj97+T2e9o3d4BWNp84K1NzubTjAB3fH0+fv6N3qP/ir9bW6ozNQCijB8/8zw/TuQ7r4/ndvN5mZgkpPXiis3Pv34+ZPh5t23//79Rwehof/9/NDEgMrOXHvJcrllgpoRN8PFOwy/fzP8+gUlgZI/f/5xcPj/69e/37//AUX+/mXRkN555gsOG2xt/5hZQMwF4r9///75++f3nz8nr75gSms82jfvQnT6zqvXPjC8e/srJQHo9P9fvwNtAHmG4f8zZ6dDc3bIyM2LTNlsbtfM9OPHH3FhtqUz3eXX9H+cOy9ZMB2o6t/Pn0DHMPz/b+2wXGTvPlPGFxdcD+mZyjP8+8MUE6sa7a/xo6Pykn1s4zdzIZ6///8zMGpKM2pKAB0jqy4UE7/msKat6Jw5mafrsxNtWZ6/fjvNLW29qv25pQd///n+5+/fxDDVbcc//P/zx/36m5Ub9zL8+7t66yEROcHK7q5bldMBAgwADcRBCuVLfoEAAAAASUVORK5CYII=',
		fr:'iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAGzSURBVHjaYiyeepkBBv79+Zfnx/f379+fP38CyT9//jAyMiq5GP77wvDnJ8MfoAIGBoAAYgGqC7STApL///3/9++/pCTv////Qdz/QO4/IMna0vf/z+9/v379//37bUUTQACBNDD8Z/j87fffvyAVX79+/Q8GQDbQeKA9fM+e/Pv18/+vnwzCIkBLAAKQOAY5AIAwCEv4/4PddNUm3ji0QJyxW3rgzE0iLfqDGr2oYuu0l54AYvnz5x9Q6d+/QPQfyAQqAin9B3EOyG1A1UDj//36zfjr1y8GBoAAFI9BDgAwCMIw+P8Ho3GDO6XQ0l4MN8b2kUwYaLszqgKM/KHcDXwBxAJUD3TJ779A8h9Q5D8SAHoARP36+Rfo41+/mcA2AAQQy49ff0Cu//MPpAeI/0FdA1QNYYNVA/3wmwEYVgwMAAHE8uPHH5BqoD1//gJJLADoJKDS378Z//wFhhJAALF8A3rizz8uTmYg788fJkj4QOKREQyYxSWBhjEC/fcXZANAALF8+/anbcHlHz9+ffvx58uPX9KckkCn/gby/wLd8uvHjx96k+cD1UGiGQgAAgwA7q17ZpsMdUQAAAAASUVORK5CYII=',
		de:'iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAGzSURBVHjaYvTxcWb4+53h3z8GZpZff/79+v3n/7/fDAz/GHAAgABi+f37e3FxOZD1Dwz+/v3z9y+E/AMFv3//+Qumfv9et241QACxMDExAVWfOHkJJAEW/gUEP0EQDn78+AHE/gFOQJUAAcQiy8Ag8O+fLFj1n1+/QDp+/gQioK7fP378+vkDqOH39x9A/RJ/gE5lAAhAYhzcAACCQBDkgRXRjP034R0IaDTZTFZn0DItot37S94KLOINerEcI7aKHAHE8v/3r/9//zIA1f36/R+o4tevf1ANYNVA9P07RD9IJQMDQACxADHD3z8Ig4GMHz+AqqHagKp//fwLVA0U//v7LwMDQACx/LZiYFD7/5/53/+///79BqK/EMZ/UPACSYa/v/8DyX9A0oTxx2EGgABi+a/H8F/m339BoCoQ+g8kgRaCQvgPJJiBYmAuw39hxn+uDAABxMLwi+E/0PusRkwMvxhBGoDkH4b/v/+D2EDyz///QB1/QLb8+sP0lQEggFh+vGXYM2/SP6A2Zoaf30Ex/J+PgekHwz9gQDAz/P0FYrAyMfz7wcDAzPDtFwNAgAEAd3SIyRitX1gAAAAASUVORK5CYII=',
		es:'iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAFnSURBVHjaYvzPgAD/UNlYEUAAmuTYAAAQhAEYqF/zFbe50RZ1cMmS9TLi0pJLRjZohAMTGFUN9HdnHgEE1sDw//+Tp0ClINW/f0NIKPoFJH/9//ULyGaUlQXaABBALAx/Gf4zAt31F4i+ffj3/cN/XrFfzOx//v///f//LzACM/79ZmD8/e8TA0AAMYHdDVT958vXP38nMDB0s3x94/Tj5y+YahhiAKLfQKUAAcQEdtJfoDHMF2L+vPzDmFXLelf551tGFOOhev4A/QgQQExgHwAd8IdFT/Wz6j+GhlpmXSOW/2z///8Eq/sJ18Dw/zdQA0AAMQExxJjjdy9x2/76EfLz4MXdP/i+wsyGkkA3Aw3984cBIIAYfzIwMKel/bt3jwEaLNAwgZIQxp/fDH/+MqqovL14ESCAWICeZvr9h0FSEhSgwBgAygFDEMT+wwAhgQgc4kAEVAwQQIxfUSMSTxxDAECAAQAJWke8v4u1tAAAAABJRU5ErkJggg==',
		kr:'iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAHiSURBVHjaYvz4/SsDEvj37x+YhLCgGAb+ADFAADEBpfk4uIDo2YNHV89fZP3PyMfBLcDFxc/NLcjNy8nMfPnM2cd374ry84sJCAE1AAQQC8Tg169fb9269cP7DyJiYsqKiv/v3v3/589/FZVnL16uXbtGQFBQWEhIRlYWaAVAAIFs+P///4cPH37//m1oYqwsJfm/t/d/QcH/vJz/ddUKYqJuXl5v3rx5/uIFUBnQBoAAYgT6gZedE6jt1atXXLy8jHsOcEyd+P/37y9/mH7+/CWQEPEpIvLj6zdS0lKMjIwPnj0BCCAWiC+BukVERICMnW/4jP8w/2bibDLMf/aTvfrxOX12dm5pKaACBkZGoJMAAgioAaQaCN6+fcvDzfVVXTdXvZKZjfURu9iHHz/vGrupf//85u1HSUlJRqCef/8AAogJiIGqb968OW3aNKC/PQw4VS1UnjALMXz/4azD5uokvW/f/vr6+pMnT0L8ABBALP/AocTFxQXkHzx0WFNLszZM7ZIJ+5+//3UV2O/du7l6zXphYWEBAQGgAqCTAAII5AcgS1pa2t3d/eXLl2JikkD9ekpcEHeKi0t5eHgANairq4PjlQEggBifv32LHJFwiuEPmMEAYf/5A1YNxAABBgCFMRk3L8TWJAAAAABJRU5ErkJggg==',
		cn:'iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAFqSURBVHjaYrzOwPAPjJgYQEDAleHVbhADIvgHLPgHiQ0QQCxAlkR9NW8sw+cV/1gV/7Gb/hV4+vfzhj8Mv/78//Pn/+/f/8AkhH1t0yaAAAJp4I37zyz2lDfu79uqv/++/WYz+cuq/vvLxt8gdb+A5K9/v34B2SyyskBLAAII5JAva/7/+/z367a/f3/8ZuT9+//Pr78vQUrB6n4CSSj6/RuoASCAWEDO/fD3ddEfhv9/OE3/sKj8/n7k9/fDQNUIs/+DVf8HawAIIJCT/v38C3Hr95N/GDh/f94AVvT7N8RUBpjxQAVADQABBNLw/y/Ifwy/f/399ufTOpDBEPf8g5sN0QBEDAwAAQTWABEChgOSA9BVA00E2wAQQCANQBbEif/AzoCqgLkbbBYwWP/+//sXqBYggFhAkfL7D7OkJFCOCSj65zfUeFjwg8z++/ffX5AGoGKAAGI8jhSRyIw/SJH9D4aAYQoQYAA6rnMw1jU2vQAAAABJRU5ErkJggg==',
		ru:'iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAE2SURBVHjaYvz69T8DAvz79w9CQVj/0MCffwwAAcQClObiAin6/x+okxHMgPCAbOb//5n+I4EXL74ABBALxGSwagTjPzbAyMgItAQggBg9Pf9nZPx//x7kjL9////9C2QAyf9//qCQQCQkxFhY+BEggFi2b/+nq8v46BEDSPQ3w+8//3//BqFfv9BJeXmQEwACCOSkP38YgHy4Bog0RN0vIOMXVOTPH6Cv/gEEEEgDxFKgHEgDXCmGDUAE1AAQQCybGZg1f/d8//XsH0jTn3+///z79RtE/v4NZfz68xfI/vOX+4/0ZoZFAAHE4gYMvD+3/v2+h91wCANo9Z+/jH9VxBkYAAKIBRg9TL//MEhKAuWAogxgZzGC2CCfgUggAoYdGAEVAwQQ41egu5AQAyoXTQoIAAIMAD+JZR7YOGEWAAAAAElFTkSuQmCC',
		jp:'iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAE2SURBVHjaYvz69SsDEvj37x+ERGbAwZ9//wACiAUoysXFBST///8P0QOm//+HU0jgxYsXAAHEAlP0H8HYt+//4SP/f//6b2b238sLrpqRkRFoCUAAsaCrXrv2/8KF///8+f/r9//Dh/8/ffI/OQWiAeJCgABigrseJPT27f/Vq////v3/1y8oWrzk/+PHcEv+/PkDEEBMEM/B3fj/40eo0t9g8suX/w8f/odZAVQMEEAsQAzj/2cQFf3PxARWCrYEaBXQLCkpqB/+/wcqBgggJrjxQPX/hYX/+/v///kLqhpIBgf/l5ODhxiQBAggFriToDoTEv5zcf3ftQuk2s7uf0wM3MdAAPQDQAAxvn37lo+PDy4KZUDcycj4/z9CBojv3r0LEEAgG969eweLSBDEBSCWAAQYACaTbJ/kuok9AAAAAElFTkSuQmCC',
		sa:'iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAG5SURBVHjaYmTwZkCAfwwMf8DoF4wEoh9IjB8MAAEYFJMbAEAYhvXBsLAFrAMj5iiR/LAsj2xn7q7qMkVZtmnGKdEAkRgg3PW+AAJpAKp+9vEZUB0TAxOQ9+3nt19/frGysP3+8+v7rx//Gf5//fnly4/PMkKyQMUAAcQCdMb///9//vlhpWijLKz6+cen0/fPGMjpszGxMTMyHb171E7V/vKzSwuOzwVaBdQAEEAgDWAH/AXyP33/wMHKKSMgzcnMee/1vZ9/fn74/uHtlzfMDMy//gJdBtIAEEBMQN8A3ffn728RbhEFEYXXX958+fXl2otrHGzs155f42Dmuvv67o5rO/6CvAQMBwaAACTN0Q0AEAwFQO3+i4hhLOJXQvvahxjgcm+IBFlar0K5m4WZG4CFraJjDsCZ/OAIIBagDX/A1v36/TPJOomLhRvoJXhY8bHzAaWyV2T9/PsTyAVqAAggmAYg/Pdn8r7Jf/6BFAMtAYoAyQKngsO3DgP1QAIaqAEggFiAcfH73x8JPglwkANFf4OkgUb8A5Erzi4H+k9OSB6oAWgnUANAADEyKKNEJMNPBvwAIMAAMHo3F4Y5Tq0AAAAASUVORK5CYII='
	},
	langs_html = '';
	for (var k in LANGS)
		langs_html += '<a href="javascript:retranslateDocument(\''+ k +'\');"><img src="data:image/png;base64,'+ LANGS[k] +'"></a>\n';

// https://kw-themes.com/themeforest/malpha2-mobile-template/?from=tf&theme=malpha2
	var html = `
<style type="text/css">
body, input, textarea { font-family:sans-serif; font-size:18px; }
</style>

<center>
<!-- Our logo does not matter - so we used http://linkus.flamingtext.com/ -->
<a href="wtf.html"><img alt="Covert.Chat Logo" style="max-width:100%; width:300px;" src="https://s3.ca-central-1.amazonaws.com/cdn.covert.chat/logo.png"><br/>
<span style="font-size:14px;">Transparent Encrypted Messaging</span></a><br/>
`+ langs_html +`
</center>

<br/>
<div id="error" style="font-weight:bold; color:red;"></div>

<div id="history" style="background:#bbbbbb; font-size:12px; padding-bottom:18px;"></div>
<div id="your-message" style="background:#eeeeee; padding:3px; width:100%; margin:2px; display:none;">

{SMBUTTON::replyButton::composeMessage();::Reply}

</div>
<hr>

<div id="to-replyto" style="display:none;">
	<span style="display:inline-block; max-width:50%; width:120px;">Reply-To</span> <input type="tel" placeholder="1-613-555-1212" id="myphonenum" value="" style="font-family:monospace; max-width:50%; width:240px;"><br/>
	<span style="display:inline-block; max-width:50%; width:120px;">To </span> <input type="tel" placeholder="1-613-555-1212" id="phonenum" value="" style="font-family:monospace; max-width:50%; width:240px;" onblur="phonenumBlur(this);"><br/>
</div>
<div id="passphrase-div" style="display:none;">
	<span style="display:inline-block; max-width:50%; width:120px;">Passphrase</span> <input type="text" placeholder="Passphrase" id="passphrase" autocorrect="off" autocapitalize="none" value="" style="font-family:monospace; max-width:50%; width:240px;">
	<a href="javascript:genPass();" id="genPass" style="display:none;"><img src="random32.png" style="vertical-align:middle;"></a>
	<br/>
	<hr>
</div>

<div id="compose-message" style="display:none; margin-bottom:5px;">
	<div style="background:#eeeeee; border:0px solid blue; padding:3px; display:inline-block; width:100%; margin:2px;">
		<textarea id="plaintext" rows="5" cols="30" style="width:100%;" placeholder="Your message goes here"></textarea>
	</div>
	<div style="background:#eeeeee; padding:3px; display:inline-block; width:100%; margin:2px;">
		Encrypted Message:<br/>

		<div style="display:none; width:90%; padding:10px; border:2px dashed red;" id="entProgressExt">
			Move your mouse.<br/>
			<div style="display:inline-block; width:0%; height:10px; background:green;" id="entProgress"></div>
		</div>

		<span id="ciphertext" style="font-family:monospace; background:#cccccc; padding:4px; display:inline-block; margin:2px; width:90%;  overflow-wrap:break-word; word-wrap:break-word; -ms-word-break:break-all; word-break:break-all; word-break:break-word; -ms-hyphens:none; -moz-hyphens:none; -webkit-hyphens:none; hyphens:none;"></span>
		<br/>
		Length <span id="ciphertext_len"></span>
		<br/>

	</div>
	{BUTTON::sendButton::sendMessage();::Send Message to: ...}
</div>

<a href="javascript:toggleAdvanced();"><span style="display:inline-block; height:40px; width:50px;"><img src="advanced_security32.png" style="vertical-align:middle;"></span>Advanced</a>
<div id="advanced" style="background:#ffcccc; display:none; padding:5px; margin-left:30px;">
	<!-- TODO :: Diffe-Hellman handshaking activate  https://en.m.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange -->
	<a href="javascript:sendDHHandshake();" id="sendDHHandshake"><span style="display:inline-block; height:40px; width:50px;"><img src="handshakeB32.png" style="vertical-align:middle;"></span>Send Diffie-Hellman handshake</a>
	<a href="javascript:clearAllLocalStorage();"><span style="display:inline-block; height:40px; width:50px;"><img src="trash32.png" style="vertical-align:middle;"></span>Erase All Data</a><br/>
</div>

<hr>
[<a href="javascript:toggleLog()">Show console</a>]
[<a onclick="return downloadLocal();" href="https://s3.ca-central-1.amazonaws.com/cdn.covert.chat/covert_chat_2018-04-10.html">Download</a>]
<br/>
<xmp id="log" style="font-size:12px; display:none;">## log ##
</xmp><xmp id="entpool_status" style="font-size:12px; display:none;">## Entropy & Random Number Generator ##
</xmp><xmp id="debug" style="font-size:12px; display:none;">## debug ##
</xmp>

&copy; 2018 jlcooke | <a href="changelog.html">changelog</a>
<!-- Copyright 2018 Jean-Luc Cooke <jlcooke@certainkey.com> -->

<hr/>
<span style="font-size:10px;">
<a href="https://www.eff.org/"><img src="https://s3.ca-central-1.amazonaws.com/cdn.covert.chat/ads/eff.png" ALT="EFF - the Electronic Forntier Foundation" style="max-width:100%; width:300px;"><br/>
[<a href="mailto:jlcooke@certainkey.com?subject=My%20Advert%20On%20covert.chat">Your advert here?</a>]
</span>
	`;

	var button = `
<!-- buttons.cm -->
<div id="$1"><!--[if mso]>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="javascript:$2" style="v-text-anchor:middle;width:100%;height:40px;" arcsize="10%" strokecolor="#1e3650" fillcolor="#556270">
    <w:anchorlock/>
    <center id="$1Text-1" style="color:#ffffff;font-family:sans-serif;font-size:13px;font-weight:bold;">$3</center>
  </v:roundrect>
<![endif]--><a href="javascript:$2" id="$1Text-2"
style="background-color:#556270;border:1px solid #1e3650;border-radius:4px;color:#ffffff;display:inline-block;font-family:sans-serif;font-size:13px;font-weight:bold;line-height:40px;text-align:center;text-decoration:none;width:100%;-webkit-text-size-adjust:none;mso-hide:all;">$3</a></div>
`;

	html = html.replace(/{BUTTON::(.*?)::(.*?)::(.*?)}/g, button);
	button = button
		.replace(/width:100%;/g, 'width:200px;')
		.replace(/height:40px;/g, 'height:20px;');
	html = html.replace(/{SMBUTTON::(.*?)::(.*?)::(.*?)}/g, button);

	if (isMobile)
		html = html.replace(/Move your mouse./, 'Shake your smartphone.');

	document.body.innerHTML = html;
}

window.onload = function() {
	writePage();
	log(strlib.selftest());
	log(sha256.selftest());
	log(aes256.selftest());
	// log(dh.selftest()); // take too long to run on page load

	document.onmousemove = entpoolAddEvent;
	document.ontouchstart = entpoolAddEvent;
	document.ontouchmove = entpoolAddEvent;
	window.ondeviceorientation = function(evt){
		entpoolAddEvent({
			type: 'devicemotion',
			pageX: evt.alpha * evt.gamma,
			pageY: evt.beta  * evt.gamma
		});
	};

	var val, group;
	// last phonenum we sent to
	if (val=localFetch('phonenum')) {
		gel('phonenum').value = val;
		log('Found stored phonenum = '+ val);
	}

	// our phonenum for replies
	if (val=localFetch('myphonenum')) {
		gel('myphonenum').value = val;
		log('Found stored myphonenum = '+ val);
	}

	// parse the addressbook
	if (val=localFetch('addrbook')) {
		var tmp = JSON.parse(val);
		for (var k in tmp) {
			var T = { pass:tmp[k].pass, hist:{ inp:[], out:[] } };
			if (tmp[k].hist) {
				if (tmp[k].hist.inp) {
					for (var j in tmp[k].hist.inp) {
						T.hist.inp.push( tmp[k].hist.inp[j] );
					}
				}
				if (tmp[k].hist.out) {
					for (var j in tmp[k].hist.out)
						T.hist.out.push( tmp[k].hist.out[j] );
				}
			}
			addressbook[cleanPhone(k)] = T;
		}
		log('Found stored addrbook = '+ val);
	}
	if (val=localFetch('lang')) {
		_T.lang = val;
	}

	// parse the hashtag query string
	var qStr = location.href,
		ct = null;
	if (!qStr.match(/^https:/))
		return location.href = 'https://covert.chat/';
	qStr = qStr.match(/#(.*)/);
	if (qStr) {
		qStr = qStr[1].split(/&/);
		for (var i in qStr) {
			var nv = qStr[i].split(/=/);
			if (nv[0] == 'l') {
				_T.lang = nv[1];
			}
			if (nv[0] == 'c') {
				if (group=nv[1].match(/(.*?),(.*)/)) {
					gel('phonenum').value = group[1];
					nv[1] = group[2];
				}
				gel('ciphertext').innerHTML = ct = nv[1];
			}
			if (nv[0] == 'dh'  || nv[0] == 'dhr') {
				if (group=nv[1].match(/(.*?),(.*)/)) {
					gel('phonenum').value = group[1];
					nv[1] = group[2];
				}
				storeDHHandshake(nv[1]);
				if (nv[0] == 'dh') {
					sendDHHandshake(sendMessage, 1);
				}
			}
		}
	}
	if (!_T.lang)
		_T.lang = 'en';
	localStore('lang', _T.lang);
	translateDocument();

	if (!isMobile)
		alert(_T('Warning\n\nYou are using this from a non-mobile browser.  SMS messaging (usually) only works from a mobile phone.'));

	var addr = gel('phonenum').value,
		A = addressbookFetch( addr );
	gel('passphrase').value = A.pass || '';

	showChatHistory(addr, A);

	if (ct) {
		showMessage();
	} else {
		composeMessage();
	}
}; // onload

function storeDHHandshake(wrapped) {
	var dh = new DH();
	var secret = getDHSecret();

	if (secret < 0) {
		return alert('Cannot complete this handshake without localStorage enabled device.  Use your own password.');
	}
	if (!secret) {
		console.log('No secret found, generating...');
		return generateDHSecret(function(){ storeDHHandshake(wrapped); });
	}

	var shared = gel('passphrase').value = strlib.base64FromBytes( dh.handshake(secret, wrapped) );
	addressbookStore(gel('phonenum').value, shared);
}
function sendDHHandshake(cb, reply) {
	var phone = gel('phonenum'),
		myphone = gel('myphonenum');
	if (phone.value == '')
		return phone.focus();
	if (myphone.value == '')
		return myphone.focus();

	hide('sendDHHandshake')
//localStore('dh_secret_base62','');
	wrapDHSecret(function(wrapped){
		var uri = 'https://covert.chat/#'+ (reply?'dhr':'dh') +'='+ gel('myphonenum').value +','+ wrapped;
		gel('sendButton').setAttribute('uri',
			'sms:'+ phone.value +(isMacOS ?'&' :'?') +'body='+ encodeURIComponent(uri)
		);
		gel('ciphertext').innerHTML = uri;
		gel('ciphertext_len').innerHTML = uri.length;
		if (cb) cb();
	});
}
function wrapDHSecret(callback) {
	var dh = new DH();
	var secret = getDHSecret();
	if (secret < 0)
		return;
	if (!secret) {
		console.log('No secret found, generating...');
		return generateDHSecret(function(){ wrapDHSecret(callback); });
	}

	callback( dh.wrapSecret(secret) );
}
function getDHSecret() {
	switch(localStore('test')) {
		case -2: alert('localStorage is disabled on this device, cannot generate handshake without localStorage'); return -2;
		case -1: alert('localStorage is unavailable on this device, cannot generate handshake without localStorage'); return -1;
		default: break;
	}

	var secret;
	if (secret=localFetch('dh_secret_base62')) {
		return secret;
	}
	return null;
}
function generateDHSecret(callback) {
	collectEntropy(function() {
		var sha256 = new SHA256JS(),
			secret = strlib.hexFromInts( sha256.hashStr(entpool.str) );
		secret = BigInteger.parse(secret.toUpperCase(), 16)  .toString(62);
		localStore('dh_secret_base62', secret);
		callback();
	});
}
function collectEntropy(completeCB) {
	var COUNT = 1024;

	show('entProgressExt');
	updateEntPool.cb = function(count) {
		if (count%10 == 0)
			console.log('collectEntropy countdown='+count +',entpool.length='+entpool.str.length +', entpool=...'+ entpool.str.substr(-100));

		gel('entProgress').style.width = ((COUNT-count) / COUNT *100) +'%';
		if (count <= 0) {
			hide('entProgressExt');
			completeCB();
		}
	};

	// this will cause entpool compression to stop until we reach zero
	updateEntPool.count = COUNT;
}

// END of gui.js

