/*
 * dh.js - Diffie-Hellman key exchange
 *
 * Copyright 2018 Jean-Luc Cooke <jlcooke@certainkey.com>
 */
function DH() {
	function randomBigInteger(max) {
		var digits = max.toString().length,
			ret = '';
		for (var i=0; i<digits; i++)
			ret += Math.floor( Math.random() * 10 );
		ret = new BigInteger(ret);
		return ret.remainder(max);
	};

	return {
		generator: new BigInteger(65537),

		prime_size: 1024,
		primes: {
			// openssl prime -generate -bits 2048 then compress with base62
			// gen^key % p512  base62length = 86
			// gen^key % p768  base62length = 129
			// gen^key % p1024  base62length = 172
			// gen^key % p1536  base62length = 258
			// gen^key % p2048  base62length = 344
//			p512: BigInteger.parse('lN1QolSnQyCKT7OrSmfNKmbZhcfk5nKkcveU3alyQUdl6betFVgVN3oKsS8iAqm70pZxhw89EJYlQcbpvU7nJJ',62),
//			p768: BigInteger.parse('ub1B2oPEmj1olrAGcLfKkP2DvgYkenLNV2sYUJz0cIW6DuIFyHwItwFIa1SkEYglFBCZkXzwjvOsB3h1E9g24fMHgbxwyvQyZYNnLXbpABt4gtZypjB5fMWLhkVKtkvsz',62),
			p1024: BigInteger.parse('st3v3bdJcXDlyBb5P0KgsLxNiG2jQ4mkn6UigFmflyVNf1yFPij3x1th0pewAWm1zrrnlA8VfZbUvCjxcOxmaF8G8coTTr7WwCGxqXppwbze56odZhxcRkPOazBQZY40UYPBOMIsKUVhiICwfMSbRQveGONe18oPAghikPZeWZrv',62),
//			p1536: BigInteger.parse('gzxHKiGxcAoj9fdaDpvyM8xQvDcOkFtrRtRrDGqiuEZmKrIkwCG7iqJ857PfBj4TyEdIH7NbpsVXGxxmIVaeENiq5hBHSBnwjZ5CtQCbpbIZiW7CLfA3JQ49ibm5G4hKOlhPYqHCKBWHD6Ufxh88xwMD3ewbxAEOPEHikdYdrkd79gHJWXYneTKkKeWSqh9XnyNOAJMyypD09eJcUzYQuEzBtyJDQP2tECvyucuG4vYWnIbAqeq0aR4kQ1K9L2UHRr',62),
//			p2048: BigInteger.parse('pfWV3jYFAHkUjfKNdI7GLY8IG0cQJPcI5772O9fVSQoY9toG8HpeQ2RighXEHDnpaMyGeIi8TKdsZnuenkcpWcpfLmcwhjrRhHa5zSKOKtAOWlOnGKsDN9XXIei15OYSr8pHrOhieTdfJ4Y24aoacmHcYEOusRkCG87I1xrcpNJyHL5gZnisqeaZymuxaUG9RjPjDoGfs0nxPr4W893bRWhx5N6RZ1kC8HoBL8PXAzikVv5mqhcwgFaIV4tLMfcRVoEVtYFJP3GQTaj2A2q5JDkj3KIwH5y5Gc9DwLjaZA5xVAdFx5N2903kOMyHLK4qHurk1RQQ7uSn52blUqnX7Xkb',62),
		},
		getPrime: function(bits) {
			if (!bits  ||  !this.primes['p'+bits])
				bits = this.prime_size;
			return this.primes['p'+bits];
		},

		// wrapped = (generator ^ secret) mod prime
		wrapSecret: function(secret, bits) {
			if (typeof secret == 'string') {
				return this.generator.modPow(BigInteger.parse(secret,62), this.getPrime(bits)) .toString(62);
			}

			return this.generator.modPow(secret, this.getPrime(bits));
		},

		// sharedSecret = (theirs ^ secret) mod prime
		handshake: function(secret, theirs, bits) {
			if (!bits  ||  !this.primes['p'+bits])
				bits = this.prime_size;

			if (typeof secret == 'string') {
				var str = new Strlib();
				return str.hexToBytes( BigInteger.parse(theirs,62) .modPow(BigInteger.parse(secret,62), this.getPrime(bits)) .toString(16) );
			}

			return theirs.modPow(secret, this.getPrime(bits));
		},

		selftest: function() {
			var sA = '9AAaZmqFloDor5KsHOxeVqbQmZQvvqo9gMwNWvCUj2o',
				sB = 'HOdSEoiUvGLmF7aqnj6yZmBmXD11vd7LjMP1sADwi20';

			for (var bits in this.primes) {
				bits = 1 * bits.substr(1);
				var NsA = this.wrapSecret(sA, bits),
					NsB = this.wrapSecret(sB, bits),
					handshakeA = this.handshake(sA, NsB, bits),
					handshakeB = this.handshake(sB, NsA, bits);
				if (handshakeA.join(',') != handshakeB.join(',')) {
					throw new Error('DH.selftest failed to agree on hashshake for prime bits='+ bits);
				}
			}

			var sA = BigInteger.parse(sA,62),
				sB = BigInteger.parse(sB,62);

			for (var bits in this.primes) {
				bits = 1 * bits.substr(1);
				var NsA = this.wrapSecret(sA, bits),
					NsB = this.wrapSecret(sB, bits),
					handshakeA = this.handshake(sA, NsB, bits),
					handshakeB = this.handshake(sB, NsA, bits);
				if (handshakeA.compare(handshakeB) != 0) {
					throw new Error('DH.selftest failed to agree on hashshake for prime bits='+ bits);
				}
			}

			return '[[ dh.selftest() passed ]]';
		}
	};
};
this.DH = DH;
