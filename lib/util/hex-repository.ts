import { type KeyObject, createHash, createPublicKey } from 'node:crypto';
import { z } from 'zod/v4';
import { HOST_DISABLED } from '../constants/error-messages.ts';
import * as hostRules from './host-rules.ts';
import { applyAuthorization, getAuthorizationHeader } from './http/auth.ts';
import { checkUrl, preflightHostname } from './http/host-guard.ts';
import {
  type HostRulesGotOptions,
  applyHostRule,
  findMatchingRule,
} from './http/host-rules.ts';
import { Http } from './http/index.ts';
import { regEx } from './regex.ts';
import {
  ensureTrailingSlash,
  joinUrlParts,
  parseUrl,
  trimTrailingSlash,
} from './url.ts';

const hostType = 'hex';
const http = new Http(hostType);
const invalidPublicKey = 'Expected a single RSA public key in PEM format';
const publicKeyPem = regEx(
  /^-----BEGIN (?<begin>(?:RSA )?PUBLIC KEY)-----\r?\n(?<base64>[A-Za-z0-9+/=\r\n]+)\r?\n-----END (?<end>(?:RSA )?PUBLIC KEY)-----$/,
);

const repoName = z
  .string()
  .regex(regEx(/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/))
  .refine(
    (name) => name !== 'hexpm' && name !== '__proto__',
    'Reserved Hex repository name',
  );

const baseUrl = z.string().transform((value, ctx) => {
  const url = parseUrl(value);
  if (
    !url ||
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.href.includes('?') ||
    url.href.includes('#')
  ) {
    ctx.addIssue({
      code: 'custom',
      message:
        'Expected an HTTP(S) repository URL without credentials, query or fragment',
    });
    return z.NEVER;
  }
  return trimTrailingSlash(url.href);
});

const fingerprint = z
  .string()
  .regex(
    regEx(/^SHA256:[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]$/),
    'Expected an unpadded SHA256 SSH public key fingerprint',
  );

const HexRepository = z.strictObject({
  url: baseUrl,
  publicKeyFingerprint: fingerprint,
});

export const HexRepositories = z.record(repoName, HexRepository);

export type HexRepository = z.infer<typeof HexRepository>;

export interface HexRepositoryPackage extends HexRepository {
  name: string;
  packageName: string;
}

function parseRsaPublicKey(pem: string): KeyObject | null {
  const groups = publicKeyPem.exec(pem.trim())?.groups;
  if (!groups || groups.begin !== groups.end) {
    return null;
  }

  const encoded = groups.base64.replace(regEx(/[\r\n]/g), '');
  const der = Buffer.from(encoded, 'base64');
  if (der.toString('base64') !== encoded) {
    return null;
  }

  const type = groups.begin === 'RSA PUBLIC KEY' ? 'pkcs1' : 'spki';
  try {
    const key = createPublicKey({ key: der, format: 'der', type });
    // Require the entire DER payload to be a public key of the stated type.
    if (
      key.asymmetricKeyType === 'rsa' &&
      key.export({ format: 'der', type }).equals(der)
    ) {
      return key;
    }
  } catch {
    // Invalid ASN.1 or an unsupported key.
  }
  return null;
}

function sshField(data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, data]);
}

function sshMpint(value: string): Buffer {
  const data = Buffer.from(value, 'base64url');
  // RSA parameters are unsigned; the SSH mpint encoding is signed.
  return sshField(
    data[0] & 0x80 ? Buffer.concat([Buffer.alloc(1), data]) : data,
  );
}

function getFingerprint(key: KeyObject): string {
  const { n, e } = key.export({ format: 'jwk' });
  /* v8 ignore if -- RSA public keys always have both a modulus and an exponent. */
  if (!n || !e) {
    throw new Error('Expected an RSA public key');
  }
  const hash = createHash('sha256')
    .update(sshField(Buffer.from('ssh-rsa')))
    .update(sshMpint(e))
    .update(sshMpint(n))
    .digest('base64');
  return `SHA256:${hash.slice(0, -1)}`;
}

export async function resolveHexPublicKey(
  name: string,
  repo: HexRepository,
): Promise<string> {
  const { body, statusCode } = await http.getText(
    joinUrlParts(repo.url, 'public_key'),
    { followRedirect: false, memCache: false },
  );
  if (statusCode !== 200) {
    throw new Error(`Could not fetch public key for Hex repository ${name}`);
  }

  const key = parseRsaPublicKey(body);
  if (!key) {
    throw new Error(`${invalidPublicKey} for Hex repository ${name}`);
  }
  if (getFingerprint(key) !== repo.publicKeyFingerprint) {
    throw new Error(
      `Public key fingerprint mismatch for Hex repository ${name}`,
    );
  }
  return key.export({ format: 'pem', type: 'spki' }).toString();
}

export async function preflightHexRepository(
  repo: HexRepository,
): Promise<string | undefined> {
  const url = ensureTrailingSlash(repo.url);
  const options: HostRulesGotOptions = { hostType, readOnly: true };
  const rule = findMatchingRule(url, options);
  if (rule.enabled === false) {
    throw new Error(HOST_DISABLED);
  }
  // Mix can request any package or tarball beneath the registry base.
  let internalHostGrant = rule.internalHostGrant;
  for (const { enabled, allowInternal, matchHost } of hostRules.getAll()) {
    const restrictsAccess = enabled === false || allowInternal === false;
    if (
      !restrictsAccess ||
      !matchHost ||
      !hostRules.matchesHost(matchHost, url)
    ) {
      continue;
    }
    const scopedRule = findMatchingRule(matchHost, options);
    if (scopedRule.enabled === false) {
      throw new Error(HOST_DISABLED);
    }
    if (scopedRule.internalHostGrant?.explicit === false) {
      internalHostGrant = scopedRule.internalHostGrant;
    }
  }

  const parsed = parseUrl(url)!;
  const decision = checkUrl(parsed, hostType, internalHostGrant);
  await preflightHostname(parsed, decision, hostType);
  return getAuthorizationHeader(
    applyAuthorization(applyHostRule(url, options, rule)).headers,
  );
}
