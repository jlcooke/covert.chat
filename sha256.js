/**
 * sha256.js
 *
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet, Jean-Luc Cooke
 *
 */

function SHA256JS() {

	var K = [
		0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
		0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
		0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
		0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
		0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
		0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
		0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
		0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
		0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
		0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
		0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
		0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
		0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
		0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
		0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
		0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
	];

	SHA256JS.prototype.init = function () {
		this._a = 0x6a09e667|0;
		this._b = 0xbb67ae85|0;
		this._c = 0x3c6ef372|0;
		this._d = 0xa54ff53a|0;
		this._e = 0x510e527f|0;
		this._f = 0x9b05688c|0;
		this._g = 0x1f83d9ab|0;
		this._h = 0x5be0cd19|0;

		this._len = this._s = 0;

		return this
	};

	function S(X, n) { return (X >>> n) | (X << (32 - n)); }
	function R(X, n) { return (X >>> n); }
	function Ch(x, y, z) { return ((x & y) ^ ((~x) & z)); }
	function Maj(x, y, z) { return ((x & y) ^ (x & z) ^ (y & z)); }
	function Sigma0256(x) { return (S(x, 2) ^ S(x, 13) ^ S(x, 22)); }
	function Sigma1256(x) { return (S(x, 6) ^ S(x, 11) ^ S(x, 25)); }
	function Gamma0256(x) { return (S(x, 7) ^ S(x, 18) ^ R(x, 3)); }
	function Gamma1256(x) { return (S(x, 17) ^ S(x, 19) ^ R(x, 10)); }

	SHA256JS.prototype._update = function(M, off) {
		var W = this._w;
		var a, b, c, d, e, f, g, h;
		var T1, T2;

		a = this._a | 0;
		b = this._b | 0;
		c = this._c | 0;
		d = this._d | 0;
		e = this._e | 0;
		f = this._f | 0;
		g = this._g | 0;
		h = this._h | 0;

		for (var j = 0; j < 64; j++) {
			var w = W[j] = j < 16
				? M[off+j]
				: Gamma1256(W[j - 2]) + W[j - 7] + Gamma0256(W[j - 15]) + W[j - 16];

			T1 = h + Sigma1256(e) + Ch(e, f, g) + K[j] + w;

			T2 = Sigma0256(a) + Maj(a, b, c);
			h = g; g = f; f = e; e = d + T1; d = c; c = b; b = a; a = T1 + T2;
		}

		this._a = (a + this._a) | 0;
		this._b = (b + this._b) | 0;
		this._c = (c + this._c) | 0;
		this._d = (d + this._d) | 0;
		this._e = (e + this._e) | 0;
		this._f = (f + this._f) | 0;
		this._g = (g + this._g) | 0;
		this._h = (h + this._h) | 0;
	};

	SHA256JS.prototype._final = function () {
		return [
			this._a,
			this._b,
			this._c,
			this._d,
			this._e,
			this._f,
			this._g,
			this._h
		];
	};

	SHA256JS.prototype.hashBytes = function(bytes) {
		this.init();

		var len = bytes.length;
		bytes.push(0x80);
		while (bytes.length%64 != 56)
			bytes.push(0x00);

		var ints = strlib.bytesToInts(bytes);
		ints.push(0);
		ints.push(len<<3);
		for (var i=0; i<ints.length; i+=16) {
			this._update(ints, i);
		}

		return this._final();
	};

	SHA256JS.prototype.hashStr = function(str) {
		return this.hashBytes( strlib.utf8ToBytes( str ) );
	};

	// https://en.wikipedia.org/wiki/HMAC
	// D = HMAC(K,m) = H( (K' xor opad) + H((K' xor ipad) + m) )
	SHA256JS.prototype.hmacStr = function(K,m) {
		var K_ = strlib.utf8ToBytes(K);
		while (K_.length < 64)
			K_.push( 0 );
		if (K_.length > 64)
			K_ = this.hashBytes(K_);

		var opad = [];
		var ipad = [];
		for (var i in K_) {
			opad.push(0x5c ^ K_[i]);
			ipad.push(0x36 ^ K_[i]);
		}

		M = strlib.utf8ToBytes(m);
		for (var i in M)
			ipad.push(M[i]);
		var inner = strlib.bytesFromInts(this.hashBytes(ipad));
		for (var i in inner)
			opad.push(inner[i]);
		return this.hashBytes(opad);
	};

	SHA256JS.prototype.selftest = function() {
		var sha256 = new SHA256JS();
		if (strlib.hexFromInts(sha256.hashStr('')) != 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
			throw new Error('SHA256("") failed');
		if (strlib.hexFromInts(sha256.hashStr('abc')) != 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
			throw new Error('SHA256("abc") failed');
		if (strlib.hexFromInts(sha256.hashStr('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu')) != 'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1')
			throw new Error('SHA256("abc..rstu") failed');
		if (strlib.hexFromInts(sha256.hmacStr('Jefe', 'what do ya want for nothing?')) != '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
			throw new Error('SHA256-HMAC("Jefe", "what do ya want for nothing?") failed');
		return '[[ sha256.selftest() passed ]]';
	};

	this.init();
	this._w = new Array(64)
}

// END sha256.js

