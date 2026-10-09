/**
 * Core SHA-256 (FIPS 180-4), authored as plain JavaScript with JSDoc so a
 * single file serves three consumers without duplication:
 *   1. the TypeScript main thread (imported by sha256.ts, checked via JSDoc),
 *   2. the browser hashing worker (raw text is inlined into a Blob worker),
 *   3. the Node test harness (via sha256.ts re-exports).
 *
 * Files are hashed in fixed-size slices so peak memory stays flat even for
 * multi-gigabyte inputs. Do not add imports: the worker inlines this file
 * verbatim as a module script.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const HEX = "0123456789abcdef";

export class Sha256 {
  /** @type {Uint32Array} */
  #h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  /** @type {Uint32Array} */
  #w = new Uint32Array(64);
  /** @type {Uint8Array} */
  #block = new Uint8Array(64);
  /** @type {number} */
  #blockLen = 0;
  /** @type {number} */
  #total = 0;

  /**
   * @param {Uint8Array} data
   * @returns {Sha256}
   */
  update(data) {
    this.#total += data.length;
    let i = 0;
    if (this.#blockLen > 0) {
      const take = Math.min(64 - this.#blockLen, data.length);
      this.#block.set(data.subarray(0, take), this.#blockLen);
      this.#blockLen += take;
      i = take;
      if (this.#blockLen === 64) {
        this.#compress(this.#block, 0);
        this.#blockLen = 0;
      }
    }
    while (i + 64 <= data.length) {
      this.#compress(data, i);
      i += 64;
    }
    if (i < data.length) {
      this.#block.set(data.subarray(i), 0);
      this.#blockLen = data.length - i;
    }
    return this;
  }

  /** @returns {string} lowercase hex digest */
  digestHex() {
    const bitHi = Math.floor(this.#total / 0x20000000);
    const bitLo = (this.#total % 0x20000000) * 8;
    const padLen = this.#blockLen < 56 ? 64 - this.#blockLen : 128 - this.#blockLen;
    const tail = new Uint8Array(padLen);
    tail[0] = 0x80;
    const view = new DataView(tail.buffer);
    view.setUint32(padLen - 8, bitHi);
    view.setUint32(padLen - 4, bitLo);
    this.update(tail);
    // `update` advanced `#total`, but the length words were already written.
    let out = "";
    for (let i = 0; i < 8; i++) {
      const v = this.#h[i];
      for (let shift = 28; shift >= 0; shift -= 4) {
        out += HEX[(v >>> shift) & 0xf];
      }
    }
    return out;
  }

  /**
   * @param {Uint8Array} data
   * @param {number} off
   */
  #compress(data, off) {
    const w = this.#w;
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] =
        ((data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = this.#h[0];
    let b = this.#h[1];
    let c = this.#h[2];
    let d = this.#h[3];
    let e = this.#h[4];
    let f = this.#h[5];
    let g = this.#h[6];
    let hh = this.#h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    this.#h[0] = (this.#h[0] + a) >>> 0;
    this.#h[1] = (this.#h[1] + b) >>> 0;
    this.#h[2] = (this.#h[2] + c) >>> 0;
    this.#h[3] = (this.#h[3] + d) >>> 0;
    this.#h[4] = (this.#h[4] + e) >>> 0;
    this.#h[5] = (this.#h[5] + f) >>> 0;
    this.#h[6] = (this.#h[6] + g) >>> 0;
    this.#h[7] = (this.#h[7] + hh) >>> 0;
  }
}

/**
 * One-shot helper.
 * @param {Uint8Array} bytes
 * @returns {string} lowercase hex digest
 */
export function sha256Hex(bytes) {
  return new Sha256().update(bytes).digestHex();
}
