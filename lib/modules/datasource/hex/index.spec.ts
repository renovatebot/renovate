import { generateKeyPairSync, sign as signPayload } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import protobuf from 'protobufjs';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { hostRules } from '~test/util.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import { getPkgReleases } from '../index.ts';
import { HexDatasource } from './index.ts';
import type { Package } from './v2/package.ts';
import { Package as PackageCodec } from './v2/package.ts';
import { Signed as SignedCodec } from './v2/signed.ts';

const certifiResponse = Fixtures.get('certifi.json');
const privatePackageResponse = Fixtures.get('private_package.json');

vi.mock('../../../util/host-rules.ts', () => mockDeep());

const baseUrl = 'https://hex.pm/api';
const datasource = HexDatasource.id;
const { privateKey: testPrivateKey, publicKey: testPublicKey } =
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
      format: 'pem',
      type: 'pkcs8',
    },
    publicKeyEncoding: {
      format: 'pem',
      type: 'spki',
    },
  });

interface V2ResponseOptions {
  privateKey?: string;
  signature?: Buffer;
}

function protobufLoad(file: string): Promise<protobuf.Root> {
  const resolvedFile = upath.join(import.meta.dirname, 'v2', file);
  return new Promise((resolve, reject) => {
    protobuf.load(resolvedFile, (err, root) => {
      if (err) {
        reject(err);
        return;
      }

      if (!root) {
        reject(new Error('Root is empty'));
        return;
      }

      resolve(root);
    });
  });
}

async function encodePackage(input: unknown): Promise<Buffer> {
  const message = PackageCodec.fromJSON(input);
  const root = await protobufLoad('package.proto');
  const x = root.lookupType('Package').encode(message).finish();
  return Buffer.from(x);
}

async function encodeSigned(input: unknown): Promise<Buffer> {
  const message = SignedCodec.fromJSON(input);
  const root = await protobufLoad('signed.proto');
  const x = root.lookupType('Signed').encode(message).finish();
  return Buffer.from(x);
}

async function makeV2Response(
  pkg: Package,
  options: V2ResponseOptions = {},
): Promise<Buffer> {
  const payload = await encodePackage(pkg);
  const signature =
    options.signature ??
    (options.privateKey
      ? signPayload('RSA-SHA512', payload, options.privateKey)
      : Buffer.from('fake-sig'));
  const signed = await encodeSigned({
    payload,
    signature,
  });
  return gzipSync(signed);
}

function mockPublicKeyUnavailable(registryUrl: string): void {
  httpMock.scope(registryUrl).get('/public_key').reply(404);
}

function mockPublicKey(registryUrl: string, publicKey: string): void {
  httpMock.scope(registryUrl).get('/public_key').reply(200, publicKey);
}

describe('modules/datasource/hex/index', () => {
  beforeEach(() => {
    memCache.init();
    hostRules.hosts.mockReturnValue([]);
    hostRules.find.mockReturnValue({});
  });

  afterEach(() => {
    memCache.reset();
  });

  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/packages/non_existent_package').reply(200);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'non_existent_package',
        }),
      ).toBeNull();
    });

    it('returns null for missing fields', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/non_existent_package')
        .reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'non_existent_package',
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/packages/some_package').reply(404);
      expect(
        await getPkgReleases({ datasource, packageName: 'some_package' }),
      ).toBeNull();
    });

    it('returns null for 401', async () => {
      httpMock.scope(baseUrl).get('/packages/some_package').reply(401);
      expect(
        await getPkgReleases({ datasource, packageName: 'some_package' }),
      ).toBeNull();
    });

    it('throws for 429', async () => {
      httpMock.scope(baseUrl).get('/packages/some_crate').reply(429);
      await expect(
        getPkgReleases({ datasource, packageName: 'some_crate' }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/packages/some_crate').reply(502);
      await expect(
        getPkgReleases({ datasource, packageName: 'some_crate' }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).get('/packages/some_package').replyWithError('');
      expect(
        await getPkgReleases({ datasource, packageName: 'some_package' }),
      ).toBeNull();
    });

    it('returns null with wrong auth token', async () => {
      httpMock
        .scope(baseUrl, {
          reqheaders: {
            authorization: 'abc',
          },
        })
        .get('/packages/certifi')
        .reply(401);

      hostRules.find.mockReturnValueOnce({
        authType: 'Token-Only',
        token: 'abc',
      });

      const res = await getPkgReleases({
        datasource,
        packageName: 'certifi',
      });

      expect(res).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/certifi')
        .reply(200, certifiResponse);
      const res = await getPkgReleases({
        datasource,
        packageName: 'certifi',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('process public repo without auth', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/certifi')
        .reply(200, certifiResponse);
      hostRules.find.mockReturnValueOnce({});
      const res = await getPkgReleases({
        datasource,
        packageName: 'certifi',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('extracts depreceated info', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/certifi')
        .reply(200, certifiResponse);
      hostRules.find.mockReturnValueOnce({});
      const res = await getPkgReleases({
        datasource,
        packageName: 'certifi',
      });
      expect(res?.releases.some((rel) => rel.isDeprecated)).toBeTrue();
    });

    it('processes a private repo with auth', async () => {
      httpMock
        .scope(baseUrl, {
          reqheaders: {
            authorization: 'abc',
          },
        })
        .get('/repos/renovate_test/packages/private_package')
        .reply(200, privatePackageResponse);

      hostRules.find.mockReturnValueOnce({
        authType: 'Token-Only',
        token: 'abc',
      });

      const result = await getPkgReleases({
        datasource,
        packageName: 'private_package:renovate_test',
      });

      expect(result).toMatchSnapshot();

      expect(result).toEqual({
        homepage: 'https://hex.pm/packages/renovate_test/private_package',
        sourceUrl: 'https://github.com/renovate_test/private_package',
        registryUrl: 'https://hex.pm',
        releases: [
          { releaseTimestamp: '2021-08-04T15:26:26.500Z', version: '0.1.0' },
          { releaseTimestamp: '2021-08-04T17:46:00.274Z', version: '0.1.1' },
        ],
      });
    });
  });

  describe('getReleases (V2 protocol)', () => {
    const customRegistryUrl = 'https://repo.custom-registry.example.com';

    it('extracts versions from V2 response', async () => {
      const v2Body = await makeV2Response({
        name: 'my_package',
        repository: 'custom',
        releases: [
          {
            version: '1.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
          {
            version: '2.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
          {
            version: '3.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      mockPublicKeyUnavailable(customRegistryUrl);

      httpMock
        .scope(customRegistryUrl)
        .get('/packages/my_package')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'my_package',
        registryUrls: [customRegistryUrl],
      });

      expect(result).toEqual({
        registryUrl: customRegistryUrl,
        releases: [
          { version: '1.0.0' },
          { version: '2.0.0' },
          { version: '3.0.0' },
        ],
      });
    });

    it('marks retired releases as deprecated', async () => {
      const v2Body = await makeV2Response({
        name: 'my_package',
        repository: 'custom',
        releases: [
          {
            version: '1.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
            retired: { reason: 3, message: 'use 2.0.0' },
          },
          {
            version: '2.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      mockPublicKeyUnavailable(customRegistryUrl);

      httpMock
        .scope(customRegistryUrl)
        .get('/packages/my_package')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'my_package',
        registryUrls: [customRegistryUrl],
      });

      expect(result).toEqual({
        registryUrl: customRegistryUrl,
        releases: [
          { version: '1.0.0', isDeprecated: true },
          { version: '2.0.0' },
        ],
      });
    });

    it('filters releases without versions', async () => {
      const v2Body = await makeV2Response({
        name: 'my_package',
        repository: 'custom',
        releases: [
          {
            version: '',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
          {
            version: '2.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      mockPublicKeyUnavailable(customRegistryUrl);

      httpMock
        .scope(customRegistryUrl)
        .get('/packages/my_package')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'my_package',
        registryUrls: [customRegistryUrl],
      });

      expect(result).toEqual({
        registryUrl: customRegistryUrl,
        releases: [{ version: '2.0.0' }],
      });
    });

    it('handles organization packages via V2', async () => {
      const v2Body = await makeV2Response({
        name: 'private_pkg',
        repository: 'my_org',
        releases: [
          {
            version: '0.1.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      mockPublicKeyUnavailable(customRegistryUrl);

      httpMock
        .scope(customRegistryUrl)
        .get('/repos/my_org/packages/private_pkg')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'private_pkg:my_org',
        registryUrls: [customRegistryUrl],
      });

      expect(result).toEqual({
        registryUrl: customRegistryUrl,
        releases: [{ version: '0.1.0' }],
      });
    });

    it('returns null for empty releases', async () => {
      const v2Body = await makeV2Response({
        name: 'empty_package',
        repository: 'custom',
        releases: [],
      });

      mockPublicKeyUnavailable(customRegistryUrl);

      httpMock
        .scope(customRegistryUrl)
        .get('/packages/empty_package')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'empty_package',
        registryUrls: [customRegistryUrl],
      });

      expect(result).toBeNull();
    });

    it('throws for 5xx errors', async () => {
      httpMock
        .scope(customRegistryUrl)
        .get('/packages/some_package')
        .reply(502);

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'some_package',
          registryUrls: [customRegistryUrl],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 429 errors', async () => {
      httpMock
        .scope(customRegistryUrl)
        .get('/packages/some_package')
        .reply(429);

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'some_package',
          registryUrls: [customRegistryUrl],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(customRegistryUrl)
        .get('/packages/some_package')
        .reply(404);

      expect(
        await getPkgReleases({
          datasource,
          packageName: 'some_package',
          registryUrls: [customRegistryUrl],
        }),
      ).toBeNull();
    });

    it('returns null for network error', async () => {
      httpMock
        .scope(customRegistryUrl)
        .get('/packages/some_package')
        .replyWithError('connection refused');

      expect(
        await getPkgReleases({
          datasource,
          packageName: 'some_package',
          registryUrls: [customRegistryUrl],
        }),
      ).toBeNull();
    });

    it('returns null for malformed gzip', async () => {
      httpMock
        .scope(customRegistryUrl)
        .get('/packages/bad_package')
        .reply(200, Buffer.from('not-gzip-data'));

      expect(
        await getPkgReleases({
          datasource,
          packageName: 'bad_package',
          registryUrls: [customRegistryUrl],
        }),
      ).toBeNull();
    });

    it('verifies signature when public key is available', async () => {
      const v2Body = await makeV2Response(
        {
          name: 'my_package',
          repository: 'custom',
          releases: [
            {
              version: '1.0.0',
              innerChecksum: new Uint8Array(),
              dependencies: [],
            },
          ],
        },
        { privateKey: testPrivateKey },
      );

      mockPublicKey(customRegistryUrl, testPublicKey);

      httpMock
        .scope(customRegistryUrl)
        .get('/packages/my_package')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'my_package',
        registryUrls: [customRegistryUrl],
      });

      expect(result).toEqual({
        registryUrl: customRegistryUrl,
        releases: [{ version: '1.0.0' }],
      });
    });

    it('returns null for invalid signature when public key is available', async () => {
      const v2Body = await makeV2Response(
        {
          name: 'my_package',
          repository: 'custom',
          releases: [
            {
              version: '1.0.0',
              innerChecksum: new Uint8Array(),
              dependencies: [],
            },
          ],
        },
        { signature: Buffer.from('invalid-signature') },
      );

      mockPublicKey(customRegistryUrl, testPublicKey);

      httpMock
        .scope(customRegistryUrl)
        .get('/packages/my_package')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'my_package',
        registryUrls: [customRegistryUrl],
      });

      expect(result).toBeNull();
    });

    it('caches public key responses for subsequent package lookups', async () => {
      const v2BodyOne = await makeV2Response(
        {
          name: 'first_package',
          repository: 'custom',
          releases: [
            {
              version: '1.0.0',
              innerChecksum: new Uint8Array(),
              dependencies: [],
            },
          ],
        },
        { privateKey: testPrivateKey },
      );

      const v2BodyTwo = await makeV2Response(
        {
          name: 'second_package',
          repository: 'custom',
          releases: [
            {
              version: '2.0.0',
              innerChecksum: new Uint8Array(),
              dependencies: [],
            },
          ],
        },
        { privateKey: testPrivateKey },
      );

      mockPublicKey(customRegistryUrl, testPublicKey);

      httpMock
        .scope(customRegistryUrl)
        .get('/packages/first_package')
        .reply(200, v2BodyOne);

      httpMock
        .scope(customRegistryUrl)
        .get('/packages/second_package')
        .reply(200, v2BodyTwo);

      const firstResult = await getPkgReleases({
        datasource,
        packageName: 'first_package',
        registryUrls: [customRegistryUrl],
      });

      const secondResult = await getPkgReleases({
        datasource,
        packageName: 'second_package',
        registryUrls: [customRegistryUrl],
      });

      expect(firstResult).toEqual({
        registryUrl: customRegistryUrl,
        releases: [{ version: '1.0.0' }],
      });

      expect(secondResult).toEqual({
        registryUrl: customRegistryUrl,
        releases: [{ version: '2.0.0' }],
      });
    });

    it('returns null for package name mismatch', async () => {
      const v2Body = await makeV2Response({
        name: 'different_package',
        repository: 'custom',
        releases: [
          {
            version: '1.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      mockPublicKeyUnavailable(customRegistryUrl);

      httpMock
        .scope(customRegistryUrl)
        .get('/packages/my_package')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'my_package',
        registryUrls: [customRegistryUrl],
      });

      expect(result).toBeNull();
    });

    it('returns null for organization repository mismatch', async () => {
      const v2Body = await makeV2Response({
        name: 'private_pkg',
        repository: 'wrong_org',
        releases: [
          {
            version: '1.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      mockPublicKeyUnavailable(customRegistryUrl);

      httpMock
        .scope(customRegistryUrl)
        .get('/repos/my_org/packages/private_pkg')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'private_pkg:my_org',
        registryUrls: [customRegistryUrl],
      });

      expect(result).toBeNull();
    });

    it('uses JSON API for hex.pm default registry', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/certifi')
        .reply(200, certifiResponse);

      const result = await getPkgReleases({
        datasource,
        packageName: 'certifi',
      });

      expect(result).not.toBeNull();
      expect(result?.releases.length).toBeGreaterThan(0);
    });
  });
});
