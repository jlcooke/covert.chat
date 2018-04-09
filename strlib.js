/*
 * strlib.js - string and array conversion
 */
function Strlib() {
	function fixint(value) { return value>=0 ? value : (4294967296+value); }
	function checkInt(value) {
		return (parseInt(value) === value);
	}

	function checkInts(arrayish) {
		if (!checkInt(arrayish.length)) { return false; }

		for (var i = 0; i < arrayish.length; i++) {
			if (!checkInt(arrayish[i]) || arrayish[i] < 0 || arrayish[i] > 255) {
				return false;
			}
		}

		return true;
	}

	function coerceArray(arg, copy) {
		// ArrayBuffer view
		if (arg.buffer && ArrayBuffer.isView(arg) && arg.name === 'Uint8Array') {

			if (copy) {
				if (arg.slice) {
					arg = arg.slice();
				} else {
					arg = Array.prototype.slice.call(arg);
				}
			}

			return arg;
		}

		// It's an array; check it is a valid representation of a byte
		if (Array.isArray(arg)) {
			if (!checkInts(arg)) {
				throw new Error('Array contains invalid value: ' + arg);
			}

			return new Uint8Array(arg);
		}

		// Something else, but behaves like an array (maybe a Buffer? Arguments?)
		if (checkInt(arg.length) && checkInts(arg)) {
			return new Uint8Array(arg);
		}

		throw new Error('unsupported array-like object');
	}

	function createArray(length) {
		return new Uint8Array(length);
	}

	function copyArray(sourceArray, targetArray, targetStart, sourceStart, sourceEnd) {
		if (sourceStart != null || sourceEnd != null) {
			if (sourceArray.slice) {
				sourceArray = sourceArray.slice(sourceStart, sourceEnd);
			} else {
				sourceArray = Array.prototype.slice.call(sourceArray, sourceStart, sourceEnd);
			}
		}
		targetArray.set(sourceArray, targetStart);
	}


	function utf8ToBytes(text, padding) {
		var result = [], i = 0;
		text = encodeURI(text);
		while (i < text.length) {
			var c = text.charCodeAt(i++);

			// if it is a % sign, encode the following 2 bytes as a hex value
			if (c === 37) {
				result.push(parseInt(text.substr(i, 2), 16));
				i += 2;

			// otherwise, just the actual byte
			} else {
				result.push(c)
			}
		}

		if (padding) {
			var len = result.length;
			for (var i=result.length; i<padding; i++)
				result.push( len );
		}

		return result;
	}

	function utf8FromBytes(bytes) {
		var result = [], i = 0;

		while (i < bytes.length) {
			var c = bytes[i];

			if (c < 128) {
				result.push(String.fromCharCode(c));
				i++;
			} else if (c > 191 && c < 224) {
				result.push(String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f)));
				i += 2;
			} else {
				result.push(String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)));
				i += 3;
			}
		}

		return result.join('');
	}

	function bytesFromInts(ints) {
		var ret = [], i = 0;
		while (i < ints.length*4) {
			var shift = ( 3 - (i&3) ) << 3;
			ret.push( (ints[i>>2] >> shift) & 0x0ff );
			i++;
		}
		return ret;
	}

	function bytesToInts(bytes) {
		var ret = [], i = 0;
		while (i < bytes.length) {
			ret.push(
				fixint(((bytes[i  ] << 24) & 0xff000000) |
						((bytes[i+1] << 16) & 0x00ff0000) |
						((bytes[i+2] <<  8) & 0x0000ff00) |
						((bytes[i+3]      ) & 0x000000ff))
			);
			i += 4;
		}
		return ret;
	}

	function hexToBytes(text) {
		var result = [];
		for (var i = 0; i < text.length; i += 2) {
			result.push(parseInt(text.substr(i, 2), 16));
		}

		return result;
	}

	// http://ixti.net/development/javascript/2011/11/11/base64-encodedecode-of-utf8-in-browser-with-js.html
	var Hex = '0123456789abcdef';

	function hexFromBytes(bytes) {
		var result = [];
		for (var i = 0; i < bytes.length; i++) {
			var v = bytes[i];
			result.push(Hex[(v & 0xf0) >> 4] + Hex[v & 0x0f]);
		}
		return result.join('');
	}

	function hexFromInts(ints) {
		return hexFromBytes( bytesFromInts(ints) )
	}
	function hexToInts(hex) {
		return bytesToInts( hexToBytes(hex) )
	}
	function utf8FromInts(ints) {
		return utf8FromBytes( bytesFromInts(ints) )
	}
	function utf8ToInts(utf8) {
		return bytesToInts( utf8ToBytes(utf8) )
	}

	function base64FromBytes(bytes) {
		var tmp = '';
		for (var i in bytes)
			tmp += String.fromCharCode( bytes[i] );
		return window.btoa(tmp);
	}
	function base64ToBytes(b64) {
		var tmp = atob(b64);
		var ret = [];
		for (var i=0; i<tmp.length; i++)
			ret.push( tmp.charCodeAt(i) );
		return ret;
	}
	function base64FromInts(ints) {
		return base64FromBytes( bytesFromInts(ints) )
	}
	function base64ToInts(base64) {
		return bytesToInts( base64ToBytes(base64) )
	}

	return {
		utf8ToBytes: utf8ToBytes,
		utf8FromBytes: utf8FromBytes,
		utf8ToInts: utf8ToInts,
		utf8FromInts: utf8FromInts,
		hexToBytes: hexToBytes,
		hexFromBytes: hexFromBytes,
		bytesFromInts: bytesFromInts,
		bytesToInts: bytesToInts,
		hexFromInts: hexFromInts,
		hexToInts: hexToInts,
		base64ToBytes: base64ToBytes,
		base64FromBytes: base64FromBytes,
		base64ToInts: base64ToInts,
		base64FromInts: base64FromInts,
		selftest: function() {
			var hex = '0f1e2d3c4b5a6978';
			if (hex != hexFromInts(hexToInts(hex)))
				throw new Error('hex != hexFromInts(hexToInts(hex))');
			if ('AAECA//+' != base64FromBytes([0,1,2,3,0xff,0xfe]))
				throw new Error('base64FromBytes() not working correctly');
			if ('AAECA//+' != base64FromBytes(base64ToBytes('AAECA//+')))
				throw new Error('base64ToBytes() not working correctly');
			return '[[ Strlib.selftest() passed ]]';
		}
	};
}

// END strlib.js

