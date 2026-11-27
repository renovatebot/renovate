import { generateKeyPair } from 'node:crypto';
import { promisify } from 'node:util';
import { codeBlock } from 'common-tags';
import * as httpMock from '~test/http-mock.ts';
import { HexRepositories, resolveHexPublicKey } from './hex-repository.ts';

const url = 'https://repo.oban.pro';
const publicKeyFingerprint =
  'SHA256:4/OSKi0NRF91QVVXlGAhb/BIMLnK8NHcx/EWs+aIWPc';
const publicKey = codeBlock`
  -----BEGIN RSA PUBLIC KEY-----
  MIIBCgKCAQEA4W+XcZtrO5MOmfzv8MnWSjiDK/ybKNXPVA0ZT5a4kLVHwA3GvzAE
  3DlJ1awpFOiLv9pUPKub404A03LGzCJ6Yu9+GYIW9lttKiH6aPWBpzRCTTnfaWWW
  RtHELdJU8vbv/ufHhnCB9SVThPbW+DgNhBK0FU3tKX2+vwY0sUqELhEaDQliW3NU
  m8x4bO8GxlVtFC6vVeQ1QtlTYNsUNmf8Y6D9kxmIMriDceZHm4Fvx57GI0rByBtg
  fhAD12AKwGH/xNi9CZp/xC0Efyg07oc3XpnsH9lkLb+9N5eee1cFhA2HYMZ7DtO7
  2bdoU4EDcQur9pNSO6eAosT6ZUPOSY5tfwIDAQAB
  -----END RSA PUBLIC KEY-----
`;

describe('util/hex-repository', () => {
  it('rejects a registry URL with a query', () => {
    expect(() =>
      HexRepositories.parse({
        oban: { url: `${url}?channel=private`, publicKeyFingerprint },
      }),
    ).toThrow('Expected an HTTP(S) repository URL without credentials');
  });

  it('matches the published Oban SSH fingerprint for its RSA public key', async () => {
    httpMock.scope(url).get('/public_key').reply(200, publicKey);

    const pem = await resolveHexPublicKey('oban', {
      url,
      publicKeyFingerprint,
    });

    expect(pem).toStartWith('-----BEGIN PUBLIC KEY-----');
  });

  it('uses a configured RSA public key directly without an HTTP request', async () => {
    const repository = { url, publicKey: publicKey.replaceAll('\n', '\r\n') };

    const pem = await resolveHexPublicKey('oban', repository);

    expect(HexRepositories.parse({ oban: repository })).toEqual({
      oban: repository,
    });
    expect(pem).toStartWith('-----BEGIN PUBLIC KEY-----');
  });

  it.each`
    trust
    ${{ publicKey, publicKeyFingerprint }}
    ${{}}
  `('requires exactly one trust input', async ({ trust }) => {
    const repository = { url, ...trust };

    expect(() => HexRepositories.parse({ oban: repository })).toThrow(
      'Set exactly one',
    );
    await expect(resolveHexPublicKey('oban', repository)).rejects.toThrow(
      'Set exactly one',
    );
  });

  it.each`
    description          | pem
    ${'multiple blocks'} | ${`${publicKey}\n${publicKey}`}
    ${'invalid base64'}  | ${'-----BEGIN RSA PUBLIC KEY-----\nAAAA=\n-----END RSA PUBLIC KEY-----'}
    ${'invalid DER'}     | ${'-----BEGIN RSA PUBLIC KEY-----\nAAAA\n-----END RSA PUBLIC KEY-----'}
    ${'mismatched type'} | ${publicKey.replace('END RSA PUBLIC KEY', 'END PUBLIC KEY')}
  `('rejects $description', async ({ pem }) => {
    const repository = { url, publicKey: pem };

    expect(() => HexRepositories.parse({ oban: repository })).toThrow(
      'Expected a single RSA public key',
    );
    await expect(resolveHexPublicKey('oban', repository)).rejects.toThrow(
      'Expected a single RSA public key',
    );
  });

  it('rejects an actual RSA private key and a non-RSA public key', async () => {
    const keyPair = promisify(generateKeyPair);
    const { privateKey } = await keyPair('rsa', { modulusLength: 2048 });
    const { publicKey: ecPublicKey } = await keyPair('ec', {
      namedCurve: 'prime256v1',
    });
    const rsaPrivatePem = privateKey
      .export({ format: 'pem', type: 'pkcs8' })
      .toString();
    const ecPublicPem = ecPublicKey
      .export({ format: 'pem', type: 'spki' })
      .toString();

    await expect(
      resolveHexPublicKey('oban', { url, publicKey: rsaPrivatePem }),
    ).rejects.toThrow('Expected a single RSA public key');
    await expect(
      resolveHexPublicKey('oban', { url, publicKey: ecPublicPem }),
    ).rejects.toThrow('Expected a single RSA public key');
  });

  it('rejects a redirect for the fingerprint key download', async () => {
    httpMock.scope(url).get('/public_key').reply(302, undefined, {
      location: 'https://other.example.com/public_key',
    });

    await expect(
      resolveHexPublicKey('oban', { url, publicKeyFingerprint }),
    ).rejects.toThrow('Could not fetch public key');
  });
});
