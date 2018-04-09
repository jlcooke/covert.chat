DATE=$(shell date  +"%Y-%m-%d")
BASEURL=https://s3.ca-central-1.amazonaws.com/cdn.covert.chat
LANGS=(fr de ru)

default:
	@echo "### Creating $(DATE).js and GZip'd copy ###"
	php -r 'print preg_replace("/[0-9]{4}-[0-9]{2}-[0-9]{2}.html/s", "$(DATE).html", file_get_contents("gui.js"));' > gui.js.tmp; mv gui.js.tmp gui.js
	cat header.js strlib.js sha256.js aes.js biginteger_trim.js dh.js gui.js | php replace_png_with_datauri.php > tmp.js
	php -r 'print preg_replace("/covert_chat_20..-..-..\.zip/s", "covert_chat_$(DATE).zip", file_get_contents("tmp.js"));' > $(DATE).js; rm tmp.js
	@echo ""
	gzip -9c $(DATE).js > $(DATE)-gz.js
	openssl dgst -sha256 -binary $(DATE).js | openssl base64 > $(DATE).js.sha256;
	@echo ""
	@echo "### Creating index_$(DATE).html ###"
	echo -n '<script src="$(BASEURL)/$(DATE)-gz.js" integrity="sha256-'`cat $(DATE).js.sha256`'" crossorigin="anonymous"></script>' > $(DATE)_inc.html
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("index.html"));' > index.html.tmp; mv index.html.tmp index.html
	@echo ""
	@echo "### Creating Downloadable covert_chat.zip ###"
	php -r 'print preg_replace(["/<script .*script>/","/https...s3.[0-9a-z\-]*.amazonaws.com.cdn.covert.chat./"], ["<script>\n".file_get_contents("$(DATE).js")."\n</script>",""], file_get_contents("index.html"));' > covert_chat_$(DATE).html
	gzip -9c covert_chat_$(DATE).html > covert_chat_$(DATE).html.gz
	@echo ""
	@echo "### Updating wtf*.html files ###"
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("wtf.html"));' > wtf.html.tmp; mv wtf.html.tmp wtf.html
	php -r 'print preg_replace("/[0-9]{2}-[0-9]{2}-gz.js/s", "$(DATE)-gz.js", file_get_contents("wtf.html"));' > wtf.html.tmp; mv wtf.html.tmp wtf.html
	@echo ""
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("wtf_fr.html"));' > wtf_fr.html.tmp; mv wtf_fr.html.tmp wtf_fr.html
	php -r 'print preg_replace("/[0-9]{4}-[0-9]{2}-[0-9]{2}-gz.js/s", "$(DATE)-gz.js", file_get_contents("wtf_fr.html"));' > wtf_fr.html.tmp; mv wtf_fr.html.tmp wtf_fr.html
	@echo ""
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("wtf_de.html"));' > wtf_de.html.tmp; mv wtf_de.html.tmp wtf_de.html
	php -r 'print preg_replace("/[0-9]{4}-[0-9]{2}-[0-9]{2}-gz.js/s", "$(DATE)-gz.js", file_get_contents("wtf_de.html"));' > wtf_de.html.tmp; mv wtf_de.html.tmp wtf_de.html
	@echo ""
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("wtf_ru.html"));' > wtf_ru.html.tmp; mv wtf_ru.html.tmp wtf_ru.html
	php -r 'print preg_replace("/[0-9]{4}-[0-9]{2}-[0-9]{2}-gz.js/s", "$(DATE)-gz.js", file_get_contents("wtf_ru.html"));' > wtf_ru.html.tmp; mv wtf_ru.html.tmp wtf_ru.html
	@echo ""
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("wtf_kr.html"));' > wtf_kr.html.tmp; mv wtf_kr.html.tmp wtf_kr.html
	php -r 'print preg_replace("/[0-9]{4}-[0-9]{2}-[0-9]{2}-gz.js/s", "$(DATE)-gz.js", file_get_contents("wtf_kr.html"));' > wtf_kr.html.tmp; mv wtf_kr.html.tmp wtf_kr.html
	@echo ""
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("wtf_jp.html"));' > wtf_jp.html.tmp; mv wtf_jp.html.tmp wtf_jp.html
	php -r 'print preg_replace("/[0-9]{4}-[0-9]{2}-[0-9]{2}-gz.js/s", "$(DATE)-gz.js", file_get_contents("wtf_jp.html"));' > wtf_jp.html.tmp; mv wtf_jp.html.tmp wtf_jp.html
	@echo ""
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("wtf_es.html"));' > wtf_es.html.tmp; mv wtf_es.html.tmp wtf_es.html
	php -r 'print preg_replace("/[0-9]{4}-[0-9]{2}-[0-9]{2}-gz.js/s", "$(DATE)-gz.js", file_get_contents("wtf_es.html"));' > wtf_es.html.tmp; mv wtf_es.html.tmp wtf_es.html
	@echo ""
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("wtf_sa.html"));' > wtf_sa.html.tmp; mv wtf_sa.html.tmp wtf_sa.html
	php -r 'print preg_replace("/[0-9]{4}-[0-9]{2}-[0-9]{2}-gz.js/s", "$(DATE)-gz.js", file_get_contents("wtf_sa.html"));' > wtf_sa.html.tmp; mv wtf_sa.html.tmp wtf_sa.html
	@echo ""
	php -r 'print preg_replace("/<script.*script>/", file_get_contents("$(DATE)_inc.html"), file_get_contents("wtf_cn.html"));' > wtf_cn.html.tmp; mv wtf_cn.html.tmp wtf_cn.html
	php -r 'print preg_replace("/[0-9]{4}-[0-9]{2}-[0-9]{2}-gz.js/s", "$(DATE)-gz.js", file_get_contents("wtf_cn.html"));' > wtf_cn.html.tmp; mv wtf_cn.html.tmp wtf_cn.html
	@echo ""
	@echo "### Creating build_$(DATE).zip ###"
	cp index.html index_$(DATE).html
	rm -f build_$(DATE).zip
	zip -9ry build_$(DATE).zip ads wtf*html changelog.html dict.js translation.html postcard.html index_$(DATE).html $(DATE)*.js covert_chat_$(DATE).html
	@echo ""
	@echo "### Complete ###";
	@echo "### TODO: (1) upload $(DATE)-gz.js (Content-Encoding:gzip) to AWS S3 ###"
	@echo "### TODO: (1b) upload covert_chat_$(DATE).html.gz (Content-Encoding:gzip Content-Disposition:attachment) to AWS S3 and rename to remove .gz ###"
	@echo "### TODO: (2) run on covert.chat server:  wget https://jlcooke.cs/ssms/build_$(DATE).zip; unzip -o build_$(DATE).zip ###"
	@echo "### TODO: (3) if https://covert.chat/index_$(DATE).html looks OK:  mv index_$(DATE).html index.html ###"
