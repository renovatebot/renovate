import { z } from 'zod';
import { Json } from '../util/schema-utils';
import { fromBase64 } from '../util/string';

export const DecryptedObject = Json.pipe(
  z.object({
    o: z.string().optional(),
    r: z.string().optional(),
    v: z.string().optional(),
  }),
);

/**
 * EC JSON Web Key (public key)
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#json_web_key
 */
export const EcJwkPub = z.object({
  kty: z.literal('EC'),
  crv: z.enum(['P-256', 'P-384', 'P-521']),
  x: z.string(),
  y: z.string(),
});

/**
 * EC JSON Web Key (private key)
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#json_web_key
 */
export const EcJwkPriv = EcJwkPub.extend({
  d: z.string(),
});

export type EcJwkPriv = z.infer<typeof EcJwkPriv>;

const Base64 = z.string().transform((v) => fromBase64(v));

export const EncodedEcJwkPriv = Base64.pipe(Json.pipe(EcJwkPriv));

export const EncryptedConfig = z.object({
  k: EcJwkPub,
  i: z.string().transform((v) => new Uint8Array(Buffer.from(v, 'base64'))),
  m: z.string().transform((v) => new Uint8Array(Buffer.from(v, 'base64'))),
});
export type EncryptedConfig = z.infer<typeof EncryptedConfig>;

export const EncryptedConfigString = Base64.pipe(Json.pipe(EncryptedConfig));
