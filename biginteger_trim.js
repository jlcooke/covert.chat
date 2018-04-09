/*
	JavaScript BigInteger library version 0.9.1
	http://silentmatt.com/biginteger/

	Copyright (c) 2009 Matthew Crumley <email@matthewcrumley.com>
	Copyright (c) 2010,2011 by John Tobey <John.Tobey@gmail.com>
	Licensed under the MIT license.

	// trimmed, added support for bases 33 to 62
	Copyright (c) 2018 Jean-Luc Cooke <jlcooke@certainkey.com>

	Support for arbitrary internal representation base was added by
	Vitaly Magerya.
*/

var BigInteger = (function() {
"use strict";

function BigInteger(n, s, token) {
	if (token !== CONSTRUCT) {
		if (n instanceof BigInteger) {
			return n;
		}
		else if (typeof n === "undefined") {
			return ZERO;
		}
		return BigInteger.parse(n);
	}

	n = n || [];
	while (n.length && !n[n.length - 1]) {
		--n.length;
	}
	this._d = n;
	this._s = n.length ? (s || 1) : 0;

	for (var m in methods)
		this[m] = methods[m];
}

var CONSTRUCT = {};

BigInteger._construct = function(n, s) {
	return new BigInteger(n, s, CONSTRUCT);
};


var methods = {
toString: function(base) {
	base = +base || 10;
	if (base < 2 || base > 62) {
		throw new Error("illegal radix " + base + ".");
	}
	if (this._s === 0) {
		return "0";
	}
	if (base === 10) {
		var str = this._s < 0 ? "-" : "";
		str += this._d[this._d.length - 1].toString();
		for (var i = this._d.length - 2; i >= 0; i--) {
			var group = this._d[i].toString();
			while (group.length < BASE_LOG10) group = '0' + group;
			str += group;
		}
		return str;
	}
	else {
		var numerals = BigInteger.digits;
		base = BigInteger.small[base];
		var sign = this._s,
			n = this.abs(),
			digits = [],
			digit;

		while (n._s !== 0) {
			var divmod = n.divRem(base);
			n = divmod[0];
			digit = divmod[1];
			digits.push(numerals[digit.valueOf()]);
		}
		return (sign < 0 ? "-" : "") + digits.reverse().join("");
	}
},

parse: function(s, base) {
	function expandExponential(str) {
		str = str.replace(/\s*[*xX]\s*10\s*(\^|\*\*)\s*/, "e");

		return str.replace(/^([+\-])?(\d+)\.?(\d*)[eE]([+\-]?\d+)$/, function(x, s, n, f, c) {
			c = +c;
			var l = c < 0,
				i = n.length + c;
			x = (l ? n : f).length;
			c = ((c = Math.abs(c)) >= x ? c - x + l : 0);
			var z = (new Array(c + 1)).join("0"),
				r = n + f;
			return (s || "") + (l ? r = z + r : r += z).substr(0, i += l ? z.length : 0) + (i < r.length ? "." + r.substr(i) : "");
		});
	}

	s = s.toString();
	if (typeof base === "undefined" || +base === 10) {
		s = expandExponential(s);
	}

	var prefixRE;
	if (typeof base === "undefined") {
		prefixRE = '0[xcb]';
	}
	else if (base == 16) {
		prefixRE = '0x';
	}
	else if (base == 8) {
		prefixRE = '0c';
	}
	else if (base == 2) {
		prefixRE = '0b';
	}
	else {
		prefixRE = '';
	}
	var parts = new RegExp('^([+\\-]?)(' + prefixRE + ')?([0-9a-z]*)(?:\\.\\d*)?$', 'i').exec(s);
	if (parts) {
		var sign = parts[1] || "+",
			baseSection = parts[2] || "",
			digits = parts[3] || "";

		if (typeof base === "undefined") {
			if (baseSection === "0x" || baseSection === "0X") {
				base = 16;
			}
			else if (baseSection === "0c" || baseSection === "0C") {
				base = 8;
			}
			else if (baseSection === "0b" || baseSection === "0B") {
				base = 2;
			}
			else {
				base = 10;
			}
		}
		else if (base < 2 || base > 62) {
			throw new Error("Illegal radix " + base + ".");
		}

		base = +base;

		if (!(BigInteger.radixRegex[base].test(digits))) {
			throw new Error("Bad digit for radix " + base);
		}

		digits = digits.replace(/^0+/, "").split("");
		if (digits.length === 0) {
			return ZERO;
		}

		sign = (sign === "-") ? -1 : 1;

		if (base == 10) {
			var d = [];
			while (digits.length >= BASE_LOG10) {
				d.push(parseInt(digits.splice(digits.length-BigInteger.base_log10, BigInteger.base_log10).join(''), 10));
			}
			d.push(parseInt(digits.join(''), 10));
			return new BigInteger(d, sign, CONSTRUCT);
		}


		var d = ZERO;
		base = BigInteger.small[base];
		var small = BigInteger.small;
		for (var i = 0; i < digits.length; i++) {
			d = d.multiply(base).add(small[ BigInteger.digits_str.indexOf(digits[i]) ]);
		}
		return new BigInteger(d._d, sign, CONSTRUCT);
	}
	else {
		throw new Error("Invalid BigInteger format: " + s);
	}
},

add: function(n) {
	if (this._s === 0) {
		return BigInteger(n);
	}

	n = BigInteger(n);
	if (n._s === 0) {
		return this;
	}
	if (this._s !== n._s) {
		n = n.negate();
		return this.subtract(n);
	}

	var a = this._d,
		b = n._d,
		al = a.length,
		bl = b.length,
		sum = new Array(Math.max(al, bl) + 1),
		size = Math.min(al, bl),
		carry = 0,
		digit;

	for (var i = 0; i < size; i++) {
		digit = a[i] + b[i] + carry;
		sum[i] = digit % BASE;
		carry = (digit / BASE) | 0;
	}
	if (bl > al) {
		a = b;
		al = bl;
	}
	for (i = size; carry && i < al; i++) {
		digit = a[i] + carry;
		sum[i] = digit % BASE;
		carry = (digit / BASE) | 0;
	}
	if (carry) {
		sum[i] = carry;
	}

	for ( ; i < al; i++) {
		sum[i] = a[i];
	}

	return new BigInteger(sum, this._s, CONSTRUCT);
},

negate: function() { return new BigInteger(this._d, (-this._s) | 0, CONSTRUCT); },
abs: function() { return (this._s < 0) ? this.negate() : this; },
subtract: function(n) {
	if (this._s === 0) {
		return BigInteger(n).negate();
	}

	n = BigInteger(n);
	if (n._s === 0) {
		return this;
	}
	if (this._s !== n._s) {
		n = n.negate();
		return this.add(n);
	}

	var m = this;

	if (this._s < 0) {
		m = new BigInteger(n._d, 1, CONSTRUCT);
		n = new BigInteger(this._d, 1, CONSTRUCT);
	}


	var sign = m.compareAbs(n);
	if (sign === 0) {
		return ZERO;
	}
	else if (sign < 0) {

		var t = n;
		n = m;
		m = t;
	}


	var a = m._d,
		b = n._d,
		al = a.length,
		bl = b.length,
		diff = new Array(al),
		borrow = 0,
		i,
		digit;

	for (i = 0; i < bl; i++) {
		digit = a[i] - borrow - b[i];
		if (digit < 0) {
			digit += BASE;
			borrow = 1;
		}
		else {
			borrow = 0;
		}
		diff[i] = digit;
	}
	for (i = bl; i < al; i++) {
		digit = a[i] - borrow;
		if (digit < 0) {
			digit += BASE;
		}
		else {
			diff[i++] = digit;
			break;
		}
		diff[i] = digit;
	}
	for ( ; i < al; i++) {
		diff[i] = a[i];
	}

	return new BigInteger(diff, sign, CONSTRUCT);
},

compareAbs: function(n) {
	if (this === n) {
		return 0;
	}

	if (!(n instanceof BigInteger)) {
		if (!isFinite(n)) {
			return(isNaN(n) ? n : -1);
		}
		n = BigInteger(n);
	}

	if (this._s === 0) {
		return (n._s !== 0) ? -1 : 0;
	}
	if (n._s === 0) {
		return 1;
	}

	var l = this._d.length,
		nl = n._d.length;
	if (l < nl) {
		return -1;
	}
	else if (l > nl) {
		return 1;
	}

	var a = this._d,
		b = n._d;
	for (var i = l-1; i >= 0; i--) {
		if (a[i] !== b[i]) {
			return a[i] < b[i] ? -1 : 1;
		}
	}

	return 0;
},

compare: function(n) {
	if (this === n) {
		return 0;
	}

	n = BigInteger(n);

	if (this._s === 0) {
		return -n._s;
	}

	if (this._s === n._s) {
		var cmp = this.compareAbs(n);
		return cmp * this._s;
	}
	else {
		return this._s;
	}
},

isUnit: function() {
	return this === ONE ||
		this === M_ONE ||
		(this._d.length === 1 && this._d[0] === 1);
},

multiply: function(n) {

	if (this._s === 0) {
		return ZERO;
	}

	n = BigInteger(n);
	if (n._s === 0) {
		return ZERO;
	}
	if (this.isUnit()) {
		if (this._s < 0) {
			return n.negate();
		}
		return n;
	}
	if (n.isUnit()) {
		if (n._s < 0) {
			return this.negate();
		}
		return this;
	}
	if (this === n) {
		return this.square();
	}

	var r = (this._d.length >= n._d.length),
		a = (r ? this : n)._d,
		b = (r ? n : this)._d,
		al = a.length,
		bl = b.length,

		pl = al + bl,
		partial = new Array(pl),
		i;
	for (i = 0; i < pl; i++) {
		partial[i] = 0;
	}

	for (i = 0; i < bl; i++) {
		var carry = 0,
			bi = b[i],
			jlimit = al + i,
			digit;
		for (var j = i; j < jlimit; j++) {
			digit = partial[j] + bi * a[j - i] + carry;
			carry = (digit / BASE) | 0;
			partial[j] = (digit % BASE) | 0;
		}
		if (carry) {
			digit = partial[j] + carry;
			carry = (digit / BASE) | 0;
			partial[j] = digit % BASE;
		}
	}
	return new BigInteger(partial, this._s * n._s, CONSTRUCT);
},

multiplySingleDigit: function(n) {
	if (n === 0 || this._s === 0) {
		return ZERO;
	}
	if (n === 1) {
		return this;
	}

	var digit;
	if (this._d.length === 1) {
		digit = this._d[0] * n;
		if (digit >= BASE) {
			return new BigInteger([(digit % BASE)|0,
					(digit / BASE)|0], 1, CONSTRUCT);
		}
		return new BigInteger([digit], 1, CONSTRUCT);
	}

	if (n === 2) {
		return this.add(this);
	}
	if (this.isUnit()) {
		return new BigInteger([n], 1, CONSTRUCT);
	}

	var a = this._d,
		al = a.length,

		pl = al + 1,
		partial = new Array(pl);
	for (var i = 0; i < pl; i++) {
		partial[i] = 0;
	}

	var carry = 0;
	for (var j = 0; j < al; j++) {
		digit = n * a[j] + carry;
		carry = (digit / BASE) | 0;
		partial[j] = (digit % BASE) | 0;
	}
	if (carry) {
		partial[j] = carry;
	}

	return new BigInteger(partial, 1, CONSTRUCT);
},

square: function() {
	if (this._s === 0) {
		return ZERO;
	}
	if (this.isUnit()) {
		return ONE;
	}

	var digits = this._d,
		length = digits.length,
		imult1 = new Array(length + length + 1),
		product, carry, k,
		i;


	for (i = 0; i < length; i++) {
		k = i * 2;
		product = digits[i] * digits[i];
		carry = (product / BASE) | 0;
		imult1[k] = product % BASE;
		imult1[k + 1] = carry;
	}


	for (i = 0; i < length; i++) {
		carry = 0;
		k = i * 2 + 1;
		for (var j = i + 1; j < length; j++, k++) {
			product = digits[j] * digits[i] * 2 + imult1[k] + carry;
			carry = (product / BASE) | 0;
			imult1[k] = product % BASE;
		}
		k = length + i;
		var digit = carry + imult1[k];
		carry = (digit / BASE) | 0;
		imult1[k] = digit % BASE;
		imult1[k + 1] += carry;
	}

	return new BigInteger(imult1, 1, CONSTRUCT);
},

divide: function(n) { return this.divRem(n)[0]; },
remainder: function(n) { return this.divRem(n)[1]; },

divRemSmall: function(n) {
	var r;
	n = +n;
	if (n === 0) {
		throw new Error("Divide by zero");
	}

	var n_s = n < 0 ? -1 : 1;
	var sign = this._s * n_s;
	n = Math.abs(n);

	if (n < 1 || n >= BASE) {
		throw new Error("Argument out of range");
	}

	if (this._s === 0) {
		return [ZERO, ZERO];
	}

	if (n === 1 || n === -1) {
		return [(sign === 1) ? this.abs() : new BigInteger(this._d, sign, CONSTRUCT), ZERO];
	}

	// 2 <= n < BASE

	// divide a single digit by a single digit
	if (this._d.length === 1) {
		var q = new BigInteger([(this._d[0] / n) | 0], 1, CONSTRUCT);
		r = new BigInteger([(this._d[0] % n) | 0], 1, CONSTRUCT);
		if (sign < 0) {
			q = q.negate();
		}
		if (this._s < 0) {
			r = r.negate();
		}
		return [q, r];
	}

	var digits = this._d.slice();
	var quot = new Array(digits.length);
	var part = 0;
	var diff = 0;
	var i = 0;
	var guess;

	while (digits.length) {
		part = part * BASE + digits[digits.length - 1];
		if (part < n) {
			quot[i++] = 0;
			digits.pop();
			diff = BASE * diff + part;
			continue;
		}
		if (part === 0) {
			guess = 0;
		}
		else {
			guess = (part / n) | 0;
		}

		var check = n * guess;
		diff = part - check;
		quot[i++] = guess;
		if (!guess) {
			digits.pop();
			continue;
		}

		digits.pop();
		part = diff;
	}

	r = new BigInteger([diff], 1, CONSTRUCT);
	if (this._s < 0) {
		r = r.negate();
	}
	return [new BigInteger(quot.reverse(), sign, CONSTRUCT), r];
},

divRem: function(n) {
	n = BigInteger(n);
	if (n._s === 0) {
		throw new Error("Divide by zero");
	}
	if (this._s === 0) {
		return [ZERO, ZERO];
	}
	if (n._d.length === 1) {
		return this.divRemSmall(n._s * n._d[0]);
	}


	switch (this.compareAbs(n)) {
	case 0:
		return [this._s === n._s ? ONE : M_ONE, ZERO];
	case -1:
		return [ZERO, this];
	}

	var sign = this._s * n._s,
		a = n.abs(),
		b_digits = this._d,
		b_index = b_digits.length,
		digits = n._d.length,
		quot = [],
		guess,

		part = new BigInteger([], 0, CONSTRUCT);

	while (b_index) {
		part._d.unshift(b_digits[--b_index]);
		part = new BigInteger(part._d, 1, CONSTRUCT);

		if (part.compareAbs(n) < 0) {
			quot.push(0);
			continue;
		}
		if (part._s === 0) {
			guess = 0;
		}
		else {
			var xlen = part._d.length, ylen = a._d.length,
				highx = part._d[xlen-1]*BASE + part._d[xlen-2],
				highy = a._d[ylen-1]*BASE + a._d[ylen-2];
			if (part._d.length > a._d.length) {


				highx = (highx+1)*BASE;
			}
			guess = Math.ceil(highx/highy);
		}
		do {
			var check = a.multiplySingleDigit(guess);
			if (check.compareAbs(part) <= 0) {
				break;
			}
			guess--;
		} while (guess);

		quot.push(guess);
		if (!guess) {
			continue;
		}
		var diff = part.subtract(check);
		part._d = diff._d.slice();
	}

	return [
		new BigInteger(quot.reverse(), sign, CONSTRUCT),
		new BigInteger(part._d, this._s, CONSTRUCT)
	];
},

isEven: function() {
	var digits = this._d;
	return this._s === 0 || digits.length === 0 || (digits[0] % 2) === 0;
},

isOdd: function() { return !this.isEven(); },

sign: function() { return this._s; },

isPositive: function() { return this._s > 0; },

isNegative: function() { return this._s < 0; },

isZero: function() { return this._s === 0; },

pow: function(n) {
	if (this.isUnit()) {
		if (this._s > 0) {
			return this;
		}
		else {
			return BigInteger(n).isOdd() ? this : this.negate();
		}
	}

	n = BigInteger(n);
	if (n._s === 0) {
		return ONE;
	}
	else if (n._s < 0) {
		if (this._s === 0) {
			throw new Error("Divide by zero");
		}
		else {
			return ZERO;
		}
	}
	if (this._s === 0) {
		return ZERO;
	}
	if (n.isUnit()) {
		return this;
	}

	if (n.compareAbs(MAX_EXP) > 0) {
		throw new Error("exponent too large in BigInteger.pow");
	}
	var x = this,
		aux = ONE,
		two = BigInteger.small[2];

	while (n.isPositive()) {
		if (n.isOdd()) {
			aux = aux.multiply(x);
			if (n.isUnit()) {
				return aux;
			}
		}
		x = x.square();
		n = n.divide(two);
	}

	return aux;
},

modPow: function(exponent, modulus) {
	var result = ONE,
		base = this;

	while (exponent.isPositive()) {
		if (exponent.isOdd()) {
			result = result.multiply(base).remainder(modulus);
		}

		exponent = exponent.divide(BigInteger.small[2]);
		if (exponent.isPositive()) {
			base = base.square().remainder(modulus);
		}
	}

	return result;
},

log: function() {
	switch (this._s) {
		case 0:  return -Infinity;
		case -1: return NaN;
		default:
	}

	var l = this._d.length;

	if (l*BASE_LOG10 < 30) {
		return Math.log(this.valueOf());
	}

	var N = Math.ceil(30/BASE_LOG10),
		firstNdigits = this._d.slice(l - N);
	return Math.log((new BigInteger(firstNdigits, 1, CONSTRUCT)).valueOf()) + (l - N) * Math.log(BASE);
},

valueOf: function() { return parseInt(this.toString(), 10); },

toJSValue: function() { return parseInt(this.toString(), 10); },
}; // methods

var BASE = 10000000,
	BASE_LOG10 = 7,
	ZERO = new BigInteger([], 0, CONSTRUCT),
	ONE = new BigInteger([1], 1, CONSTRUCT),
	M_ONE = new BigInteger(ONE._d, -1, CONSTRUCT);

BigInteger.base = BASE;
BigInteger.base_log10 = BASE_LOG10;
BigInteger.ZERO = ZERO;
BigInteger.ONE = ONE;
BigInteger.M_ONE = M_ONE;
BigInteger._0 = ZERO;
BigInteger._1 = ONE;

BigInteger.small = [
	ZERO,
	ONE
];
for (var i=2; i<=62; i++) {
	BigInteger.small[i] = new BigInteger([i], 1, CONSTRUCT);
}

BigInteger.digits_str = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
BigInteger.digits = BigInteger.digits_str.split("");

BigInteger.radixRegex = [
	/^$/,
	/^$/,
	/^[01]*$/,
	/^[012]*$/,
	/^[0-3]*$/,
	/^[0-4]*$/,
	/^[0-5]*$/,
	/^[0-6]*$/,
	/^[0-7]*$/,
	/^[0-8]*$/,
	/^[0-9]*$/,
	/^[0-9A]*$/,
	/^[0-9AB]*$/,
	/^[0-9ABC]*$/,
	/^[0-9A-D]*$/,
	/^[0-9A-E]*$/,
	/^[0-9A-F]*$/,
	/^[0-9A-G]*$/,
	/^[0-9A-H]*$/,
	/^[0-9A-I]*$/,
	/^[0-9A-J]*$/,
	/^[0-9A-K]*$/,
	/^[0-9A-L]*$/,
	/^[0-9A-M]*$/,
	/^[0-9A-N]*$/,
	/^[0-9A-O]*$/,
	/^[0-9A-P]*$/,
	/^[0-9A-Q]*$/,
	/^[0-9A-R]*$/,
	/^[0-9A-S]*$/,
	/^[0-9A-T]*$/,
	/^[0-9A-U]*$/,
	/^[0-9A-V]*$/,
	/^[0-9A-W]*$/,
	/^[0-9A-X]*$/,
	/^[0-9A-Y]*$/,
	/^[0-9A-Z]*$/,
	/^[0-9A-Za]*$/,
	/^[0-9A-Zab]*$/,
	/^[0-9A-Zabc]*$/,
	/^[0-9A-Za-d]*$/,
	/^[0-9A-Za-e]*$/,
	/^[0-9A-Za-f]*$/,
	/^[0-9A-Za-g]*$/,
	/^[0-9A-Za-h]*$/,
	/^[0-9A-Za-i]*$/,
	/^[0-9A-Za-j]*$/,
	/^[0-9A-Za-k]*$/,
	/^[0-9A-Za-l]*$/,
	/^[0-9A-Za-m]*$/,
	/^[0-9A-Za-n]*$/,
	/^[0-9A-Za-o]*$/,
	/^[0-9A-Za-p]*$/,
	/^[0-9A-Za-q]*$/,
	/^[0-9A-Za-r]*$/,
	/^[0-9A-Za-s]*$/,
	/^[0-9A-Za-t]*$/,
	/^[0-9A-Za-u]*$/,
	/^[0-9A-Za-v]*$/,
	/^[0-9A-Za-w]*$/,
	/^[0-9A-Za-x]*$/,
	/^[0-9A-Za-y]*$/,
	/^[0-9A-Za-z]*$/,
	/^[0-9A-Za-z_]*$/,
	/^[0-9A-Za-z_\-]*$/
];



for (var m in methods) {
	BigInteger[m] = methods[m];
}

// needs to be defined way down here
var MAX_EXP = BigInteger(0x7FFFFFFF);
BigInteger.MAX_EXP = MAX_EXP;

return BigInteger;
})();

// END biginteger_trim.js

