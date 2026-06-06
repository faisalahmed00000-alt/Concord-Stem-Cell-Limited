// Web Crypto API helpers for Zero-Knowledge client-side decryption
// with an automatic pure JS fallback using node-forge if Web Crypto is unavailable.
import forge from 'node-forge';

// Ensure node-forge is seeded with platform-independent entropy if it isn't already.
export function seedForge(): void {
  try {
    const items: string[] = [];
    items.push(Date.now().toString());
    items.push(Math.random().toString());
    if (typeof window !== 'undefined') {
      if (window.screen) {
        items.push(window.screen.width + 'x' + window.screen.height);
        items.push(window.screen.colorDepth + '');
      }
      if (window.navigator) {
        items.push(window.navigator.userAgent || '');
        items.push(window.navigator.language || '');
      }
      if (window.location) {
        items.push(window.location.href || '');
      }
      // Use crypto.getRandomValues to seed if available
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const temp = new Uint8Array(32);
        window.crypto.getRandomValues(temp);
        let binaryHex = '';
        for (let i = 0; i < temp.length; i++) {
          binaryHex += temp[i].toString(16);
        }
        items.push(binaryHex);
      }
    }
    const entropyString = items.filter(Boolean).join('|');
    (forge.random as any).collect(entropyString);

    // Also collect direct Math.random bytes
    const randomBytes: number[] = [];
    for (let i = 0; i < 64; i++) {
      randomBytes.push(Math.floor(Math.random() * 256));
    }
    (forge.random as any).collect(String.fromCharCode(...randomBytes));
  } catch (err) {
    console.warn('[Crypto] Failed to seed forge PRNG helper:', err);
  }
}

// Initial seeding of forge random generator
seedForge();

// Convert array buffer to base64 string
function bufferToBase64(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof btoa === 'function') {
      return btoa(binary);
    } else {
      return forge.util.encode64(binary);
    }
  } catch (e) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return forge.util.encode64(binary);
  }
}

// Convert base64 string to array buffer
function base64ToBuffer(base64: string): ArrayBuffer {
  try {
    let binary: string;
    if (typeof atob === 'function') {
      binary = atob(base64);
    } else {
      binary = forge.util.decode64(base64);
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    const binary = forge.util.decode64(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Check if secure Web Crypto is available in the browser/context
function isWebCryptoAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 
           window.isSecureContext !== false &&
           window.crypto !== undefined && 
           window.crypto.subtle !== undefined;
  } catch (e) {
    return false;
  }
}

// Custom wrapper key interface for Web Crypto and pure-JS seamless fallback
export interface DerivedKeyWrapper {
  nativeKey?: any; // CryptoKey
  _fallbackKeyHex: string;
}

// Derive a CryptoKey from a user password using PBKDF2
export async function deriveKey(password: string, saltBase64: string): Promise<any> {
  // Always seed first
  seedForge();
  
  let fallbackKeyHex = '';
  try {
    const saltBytes = forge.util.decode64(saltBase64);
    const utf8Password = forge.util.encodeUtf8(password);
    const derivedBytes = forge.pkcs5.pbkdf2(
      utf8Password,
      saltBytes,
      100000,
      32,
      forge.md.sha256.create()
    );
    fallbackKeyHex = forge.util.bytesToHex(derivedBytes);
  } catch (err) {
    console.error('[Crypto-Fallback] Failed to pre-derive fallback key hex', err);
  }

  if (isWebCryptoAvailable()) {
    try {
      const encoder = new TextEncoder();
      const passwordBytes = encoder.encode(password);
      const saltBytes = new Uint8Array(base64ToBuffer(saltBase64));

      // Import password as base key data
      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        passwordBytes,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      // Derive key using PBKDF2 with AES-GCM 256
      const derivedKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: 100000,
          hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      
      return {
        nativeKey: derivedKey,
        _fallbackKeyHex: fallbackKeyHex
      };
    } catch (e) {
      console.warn('[Crypto] Web Crypto subtle deriveKey failed, falling back to pure-JS:', e);
    }
  }

  // Fallback
  console.warn('[Crypto-Fallback] Using pure-JS cryptographic fallback for deriveKey.');
  if (!fallbackKeyHex) {
    try {
      const saltBytes = forge.util.decode64(saltBase64);
      const utf8Password = forge.util.encodeUtf8(password);
      const derivedBytes = forge.pkcs5.pbkdf2(
        utf8Password,
        saltBytes,
        100000,
        32,
        forge.md.sha256.create()
      );
      fallbackKeyHex = forge.util.bytesToHex(derivedBytes);
    } catch (e: any) {
      console.error('[Crypto-Fallback] Ultimate PBKDF2 key derivation failed', e);
      throw new Error('Ultimate PBKDF2 key derivation failed: ' + (e?.message || String(e)));
    }
  }

  return {
    _fallbackKeyHex: fallbackKeyHex
  };
}

// Generate a random salt for register
export function generateSalt(): string {
  // Always seed first to keep node-forge random fully initialized
  seedForge();
  try {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      return bufferToBase64(salt.buffer);
    }
  } catch (e) {
    console.warn('[Crypto] getRandomValues failed, using forge fallback for salt generation', e);
  }
  
  try {
    const bytes = forge.random.getBytesSync(16);
    return forge.util.encode64(bytes);
  } catch (e) {
    console.warn('[Crypto] forge getBytesSync salt failed, using Math.random fallback', e);
    const fallbackBytes = [];
    for (let i = 0; i < 16; i++) {
      fallbackBytes.push(Math.floor(Math.random() * 256));
    }
    return forge.util.encode64(String.fromCharCode(...fallbackBytes));
  }
}

// Generate password verifier hash using PBKDF2 so password is never stored in plaintext
export async function hashPassword(password: string, saltBase64: string): Promise<string> {
  seedForge();

  if (isWebCryptoAvailable()) {
    try {
      const encoder = new TextEncoder();
      const passwordBytes = encoder.encode(password);
      const saltBytes = new Uint8Array(base64ToBuffer(saltBase64));

      const baseKey = await window.crypto.subtle.importKey(
        'raw',
        passwordBytes,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: 100000,
          hash: 'SHA-256'
        },
        baseKey,
        256 // length in bits
      );

      return bufferToBase64(derivedBits);
    } catch (e) {
      console.warn('[Crypto] Web Crypto hashPassword failed, falling back to pure-JS:', e);
    }
  }

  // Fallback
  try {
    const saltBytes = forge.util.decode64(saltBase64);
    const utf8Password = forge.util.encodeUtf8(password);
    const derivedBytes = forge.pkcs5.pbkdf2(
      utf8Password,
      saltBytes,
      100000,
      32,
      forge.md.sha256.create()
    );
    return forge.util.encode64(derivedBytes);
  } catch (e: any) {
    console.error('[Crypto-Fallback] hashPassword fallback failed', e);
    throw new Error('Fallback hashPassword failed: ' + (e?.message || String(e)));
  }
}

// Encrypt plaintext with AES-GCM using derived CryptoKey or fallback hex key
export async function encrypt(plaintext: string, key: any): Promise<{ ciphertext: string; iv: string }> {
  seedForge();

  let nativeKey: any = null;
  let fallbackKeyHex: string = '';

  if (key) {
    if (key.nativeKey) {
      nativeKey = key.nativeKey;
    } else if (key.type === 'secret' || key.algorithm) {
      nativeKey = key;
    }
    fallbackKeyHex = key._fallbackKeyHex || (typeof key === 'string' ? key : '');
  }

  if (isWebCryptoAvailable() && nativeKey) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      
      // Generate a random 12-byte initialization vector (IV)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        nativeKey,
        data
      );

      return {
        ciphertext: bufferToBase64(ciphertextBuffer),
        iv: bufferToBase64(iv.buffer)
      };
    } catch (e) {
      console.warn('[Crypto] Web Crypto encrypt failed, falling back to pure-JS:', e);
    }
  }

  // Fallback
  try {
    if (!fallbackKeyHex) {
      throw new Error('No valid fallback key hex or raw key provided for encryption');
    }

    let ivBytes: string;
    try {
      ivBytes = forge.random.getBytesSync(12);
    } catch (e) {
      console.warn('[Crypto-Fallback] IV random bytes generation failed, using Math.random', e);
      const tempIv = [];
      for (let i = 0; i < 12; i++) {
        tempIv.push(Math.floor(Math.random() * 256));
      }
      ivBytes = String.fromCharCode(...tempIv);
    }

    const cipher = forge.cipher.createCipher('AES-GCM', forge.util.hexToBytes(fallbackKeyHex));
    cipher.start({
      iv: ivBytes,
      tagLength: 128
    });
    cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(plaintext)));
    cipher.finish();

    const ciphertextBytes = cipher.output.getBytes();
    const tagBytes = cipher.mode.tag.getBytes();
    const combined = ciphertextBytes + tagBytes;

    return {
      ciphertext: forge.util.encode64(combined),
      iv: forge.util.encode64(ivBytes)
    };
  } catch (e: any) {
    console.error('[Crypto-Fallback] Failed fallback encryption', e);
    throw new Error('Fallback encryption failed: ' + (e?.message || String(e)));
  }
}

// Decrypt ciphertext with AES-GCM using derived CryptoKey or fallback hex key
export async function decrypt(ciphertextBase64: string, ivBase64: string, key: any): Promise<string> {
  let nativeKey: any = null;
  let fallbackKeyHex: string = '';

  if (key) {
    if (key.nativeKey) {
      nativeKey = key.nativeKey;
    } else if (key.type === 'secret' || key.algorithm) {
      nativeKey = key;
    }
    fallbackKeyHex = key._fallbackKeyHex || (typeof key === 'string' ? key : '');
  }

  if (isWebCryptoAvailable() && nativeKey) {
    try {
      const ciphertext = base64ToBuffer(ciphertextBase64);
      const iv = new Uint8Array(base64ToBuffer(ivBase64));

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        nativeKey,
        ciphertext
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (e) {
      console.warn('[Crypto] Web Crypto decrypt failed, falling back to pure-JS:', e);
    }
  }

  // Fallback
  try {
    if (!fallbackKeyHex) {
      throw new Error('No valid fallback key hex or raw key provided for decryption');
    }

    const combined = forge.util.decode64(ciphertextBase64);
    const ivBytes = forge.util.decode64(ivBase64);

    // Extract raw ciphertext and the appended 16-byte authentication tag
    const ciphertextLen = combined.length - 16;
    const ciphertextOnlyBytes = combined.substring(0, ciphertextLen);
    const tagBytes = combined.substring(ciphertextLen);

    const decipher = forge.cipher.createDecipher('AES-GCM', forge.util.hexToBytes(fallbackKeyHex));
    decipher.start({
      iv: ivBytes,
      tagLength: 128,
      tag: forge.util.createBuffer(tagBytes)
    });
    decipher.update(forge.util.createBuffer(ciphertextOnlyBytes));
    const success = decipher.finish();

    if (!success) {
      throw new Error('Integrity validation failed or incorrect key. Fallback decryption failed.');
    }

    return forge.util.decodeUtf8(decipher.output.toString());
  } catch (e: any) {
    console.error('[Crypto-Fallback] Fallback decryption failed', e);
    throw new Error('Fallback decryption failed: ' + (e?.message || String(e)));
  }
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}
