import { AlpacaCredentialsSchema } from '@portfolio/contracts';
import type { AlpacaCredentials } from '@portfolio/contracts';
import type { SealedCredential } from '@portfolio/database';
import { decodeBase64 } from '../../lib/base64.js';

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const encoder = new TextEncoder();
const keyFor = (master: Uint8Array<ArrayBuffer>) =>
  crypto.subtle.importKey('raw', master, 'AES-GCM', false, ['encrypt', 'decrypt']);
const context = (version: string) => encoder.encode('yujeen:alpaca:v1:' + version);

export async function sealCredentials(
  credentials: AlpacaCredentials,
  master: Uint8Array<ArrayBuffer>,
): Promise<SealedCredential> {
  const version = crypto.randomUUID();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: context(version) },
    await keyFor(master),
    encoder.encode(JSON.stringify(credentials)),
  );
  return {
    version,
    key_version: 1,
    nonce: encode(nonce),
    ciphertext: encode(new Uint8Array(ciphertext)),
    tested_at: null,
  };
}

export async function unsealCredentials(record: SealedCredential, master: Uint8Array<ArrayBuffer>) {
  if (record.key_version !== 1) throw new Error('Unsupported encryption key version');
  const value = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(record.nonce), additionalData: context(record.version) },
    await keyFor(master),
    decodeBase64(record.ciphertext),
  );
  return AlpacaCredentialsSchema.parse(JSON.parse(new TextDecoder().decode(value)));
}
