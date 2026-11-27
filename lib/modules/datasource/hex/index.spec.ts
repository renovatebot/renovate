import {
  createHash,
  createPublicKey,
  generateKeyPair,
  sign as signPayload,
} from 'node:crypto';
import { promisify } from 'node:util';
import { gzip as _gzip } from 'node:zlib';
import protobuf from 'protobufjs';
import upath from 'upath';
import { Fixtures } from '~test/fixtures.ts';
import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { applyPackageRules } from '../../../util/package-rules/index.ts';
import { extractPackageFile } from '../../manager/mix/index.ts';
import { getPkgReleases } from '../index.ts';
import { HexDatasource } from './index.ts';
import type { Package } from './v2/package.ts';
import { Package as PackageCodec } from './v2/package.ts';
import { Signed as SignedCodec } from './v2/signed.ts';

const certifiResponse = Fixtures.get('certifi.json');
const privatePackageResponse = Fixtures.get('private_package.json');

const baseUrl = 'https://hex.pm/api';
const datasource = HexDatasource.id;
const gzip = promisify(_gzip);

const { privateKey: testPrivateKey, publicKey: testPublicKey } =
  await promisify(generateKeyPair)('rsa', {
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
  let signature = options.signature;
  if (options.privateKey) {
    signature ??= signPayload('RSA-SHA512', payload, options.privateKey);
  }
  signature ??= Buffer.from('fake-sig');
  const signed = await encodeSigned({
    payload,
    signature,
  });
  return await gzip(signed);
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
  });

  afterEach(() => {
    memCache.reset();
    GlobalConfig.reset();
  });

  describe('named Mix repository', () => {
    const host = 'https://repo.example.com';
    const url = `${host}/hex/private`;
    const { n } = createPublicKey(testPublicKey).export({ format: 'jwk' });
    // SSH strings for "ssh-rsa", exponent 65537, and 2048-bit modulus
    // (prefixed with a zero byte to preserve the unsigned value).
    const sshWirePrefix = Buffer.from(
      '000000077373682d727361000000030100010000010100',
      'hex',
    );
    const digest = createHash('sha256')
      .update(sshWirePrefix)
      .update(Buffer.from(n!, 'base64url'))
      .digest('base64');
    const repository = {
      url,
      publicKeyFingerprint: `SHA256:${digest.slice(0, -1)}`,
    };
    const pkg = PackageCodec.fromJSON({
      name: 'real_package',
      repository: 'company',
      releases: [{ version: '1.2.3' }],
    });

    it.each`
      authType        | authorization
      ${'Token-Only'} | ${'abc'}
      ${'Bearer'}     | ${'Bearer abc'}
      ${undefined}    | ${undefined}
    `(
      'verifies the selected repository and ignores package rule overrides ($authType)',
      async ({ authType, authorization }) => {
        GlobalConfig.set({ localDir: '' });
        if (authType) {
          hostRules.add({
            hostType: 'hex',
            matchHost: `${url}/`,
            token: 'abc',
            authType,
          });
        }
        const signed = await makeV2Response(pkg, {
          privateKey: testPrivateKey,
        });
        const scope = httpMock.scope(
          host,
          authorization
            ? { reqheaders: { authorization } }
            : { badheaders: ['authorization'] },
        );
        scope.get('/hex/private/public_key').reply(200, testPublicKey);
        scope.get('/hex/private/packages/real_package').reply(200, signed);

        const extracted = await extractPackageFile(
          'defp deps do\n[{:app, "~> 1.0", repo: "company", hex: :real_package}]\nend',
          'mix.exs',
          { hexRepositories: { company: repository } },
        );
        const dep = extracted!.deps[0];
        const config = await applyPackageRules({
          hexRepository: dep.hexRepository,
          datasource: dep.datasource!,
          packageName: dep.packageName!,
          registryUrls: dep.registryUrls,
          registryStrategy: 'merge' as const,
          packageRules: [
            {
              matchRegistryUrls: [url],
              overrideDatasource: 'npm',
              overridePackageName: 'wrong_package',
              registryUrls: ['https://wrong.example.com'],
            },
          ],
        });
        const [first, second] = await Promise.all([
          getPkgReleases(config),
          getPkgReleases(config),
        ]);

        expect(config).toMatchObject({
          datasource: 'npm',
          packageName: 'wrong_package',
          registryUrls: ['https://wrong.example.com'],
        });
        expect(first).toMatchObject({
          registryUrl: url,
          isPrivate: true,
          releases: [{ version: '1.2.3' }],
        });
        expect(second).toEqual(first);
      },
    );

    it.each`
      name               | repositoryName | signed
      ${'wrong_package'} | ${'company'}   | ${true}
      ${'real_package'}  | ${'wrong'}     | ${true}
      ${'real_package'}  | ${'company'}   | ${false}
    `(
      'rejects invalid signed metadata or unsigned data ($name, $repositoryName, $signed)',
      async ({ name, repositoryName, signed }) => {
        const response = await makeV2Response(
          { ...pkg, name, repository: repositoryName },
          signed
            ? { privateKey: testPrivateKey }
            : { signature: Buffer.alloc(0) },
        );
        const scope = httpMock.scope(host);
        scope.get('/hex/private/public_key').reply(200, testPublicKey);
        scope.get('/hex/private/packages/real_package').reply(200, response);

        await expect(
          getPkgReleases({
            datasource,
            packageName: 'real_package',
            hexRepository: {
              ...repository,
              name: 'company',
              packageName: 'real_package',
            },
          }),
        ).resolves.toBeNull();
      },
    );

    it('bypasses both persistent caches and keeps distinct pins out of its in-memory hit', async () => {
      GlobalConfig.set({ cachePrivatePackages: true });
      const get = vi
        .spyOn(packageCache, 'get')
        .mockResolvedValue({ releases: [{ version: '9.9.9' }] });
      const set = vi.spyOn(packageCache, 'set');
      const signed = await makeV2Response(pkg, { privateKey: testPrivateKey });
      const scope = httpMock.scope(host);
      scope.get('/hex/private/public_key').twice().reply(200, testPublicKey);
      scope.get('/hex/private/packages/real_package').reply(200, signed);
      const hexRepository = {
        ...repository,
        name: 'company',
        packageName: 'real_package',
      };
      const config = { datasource, packageName: 'real_package', hexRepository };

      await expect(getPkgReleases(config)).resolves.toMatchObject({
        releases: [{ version: '1.2.3' }],
      });
      await expect(
        getPkgReleases({
          ...config,
          hexRepository: {
            ...hexRepository,
            publicKeyFingerprint:
              'SHA256:4/OSKi0NRF91QVVXlGAhb/BIMLnK8NHcx/EWs+aIWPc',
          },
        }),
      ).resolves.toBeNull();

      expect(get).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    });

    it('does not fall back when the public key is unavailable', async () => {
      httpMock.scope(host).get('/hex/private/public_key').reply(404);

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'real_package',
          hexRepository: {
            ...repository,
            name: 'company',
            packageName: 'real_package',
          },
        }),
      ).resolves.toBeNull();
    });

    it('uses a configured Authorization header for requests to the repository', async () => {
      const path = '/artifactory/api/hex/company';
      const artifactoryUrl = `${host}${path}`;
      GlobalConfig.set({ allowedHeaders: ['Authorization'] });
      hostRules.add({
        hostType: 'hex',
        matchHost: artifactoryUrl,
        token: 'fallback-token',
        headers: { Authorization: 'Bearer artifactory-token' },
      });
      const signed = await makeV2Response(pkg, { privateKey: testPrivateKey });
      const scope = httpMock.scope(host, {
        reqheaders: { authorization: 'Bearer artifactory-token' },
      });
      scope.get(`${path}/public_key`).reply(200, testPublicKey);
      scope.get(`${path}/packages/real_package`).reply(200, signed);

      const result = await getPkgReleases({
        datasource,
        packageName: 'real_package',
        hexRepository: {
          url: artifactoryUrl,
          publicKeyFingerprint: repository.publicKeyFingerprint,
          name: 'company',
          packageName: 'real_package',
        },
      });

      expect(result).toMatchObject({
        registryUrl: artifactoryUrl,
        releases: [{ version: '1.2.3' }],
      });
    });

    it('rejects package redirects after verifying the fingerprint', async () => {
      httpMock
        .scope(host)
        .get('/hex/private/public_key')
        .reply(200, testPublicKey);
      httpMock
        .scope(host)
        .get('/hex/private/packages/real_package')
        .reply(302, undefined, {
          location: 'https://other.example.com/packages/real_package',
        });

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'real_package',
          hexRepository: {
            ...repository,
            name: 'company',
            packageName: 'real_package',
          },
        }),
      ).resolves.toBeNull();
    });

    it('does not look up an invalid package name', async () => {
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'missing',
          hexRepository: {
            ...repository,
            name: 'company',
            packageName: 'wrong/name',
          },
        }),
      ).resolves.toBeNull();
    });
  });

  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/packages/non_existent_package').reply(200);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'non_existent_package',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for missing fields', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/non_existent_package')
        .reply(200, {});
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'non_existent_package',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/packages/some_package').reply(404);
      await expect(
        getPkgReleases({ datasource, packageName: 'some_package' }),
      ).resolves.toBeNull();
    });

    it('returns null for 401', async () => {
      httpMock.scope(baseUrl).get('/packages/some_package').reply(401);
      await expect(
        getPkgReleases({ datasource, packageName: 'some_package' }),
      ).resolves.toBeNull();
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
      await expect(
        getPkgReleases({ datasource, packageName: 'some_package' }),
      ).resolves.toBeNull();
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

      hostRules.add({
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
      expect(res).toMatchObject({
        releases: [
          {
            version: '0.1.1',
            isDeprecated: true,
            releaseTimestamp: '2015-09-10T13:58:55.620Z',
          },
          { version: '0.2.0' },
          { version: '0.3.0' },
          { version: '0.4.0' },
          { version: '0.5.0' },
          { version: '0.6.0' },
          { version: '0.7.0' },
          { version: '1.0.0' },
          { version: '1.1.0' },
          { version: '1.2.0' },
          { version: '1.2.1' },
          { version: '2.0.0' },
          { version: '2.1.0' },
          { version: '2.2.0' },
          { version: '2.3.0' },
          { version: '2.3.1' },
          { version: '2.4.1' },
          { version: '2.4.2' },
          { version: '2.5.1' },
          {
            version: '2.5.2',
            releaseTimestamp: '2020-03-04T14:54:16.283Z',
          },
        ],
      });
    });

    it('process public repo without auth', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/certifi')
        .reply(200, certifiResponse);
      const res = await getPkgReleases({
        datasource,
        packageName: 'certifi',
      });
      expect(res).toMatchObject({
        releases: [
          { version: '0.1.1' },
          { version: '0.2.0' },
          { version: '0.3.0' },
          { version: '0.4.0' },
          { version: '0.5.0' },
          { version: '0.6.0' },
          { version: '0.7.0' },
          { version: '1.0.0' },
          { version: '1.1.0' },
          { version: '1.2.0' },
          { version: '1.2.1' },
          { version: '2.0.0' },
          { version: '2.1.0' },
          { version: '2.2.0' },
          { version: '2.3.0' },
          { version: '2.3.1' },
          { version: '2.4.1' },
          { version: '2.4.2' },
          { version: '2.5.1' },
          { version: '2.5.2' },
        ],
      });
    });

    it('extracts depreceated info', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/certifi')
        .reply(200, certifiResponse);
      const res = await getPkgReleases({
        datasource,
        packageName: 'certifi',
      });
      expect(res?.releases.some((rel) => rel.isDeprecated)).toBeTrue();
    });

    it('handles a package with no html_url and no github link', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/no_links')
        .reply(200, {
          releases: [
            { version: '1.0.0', inserted_at: '2021-08-04T15:26:26.500Z' },
          ],
        });
      const res = await getPkgReleases({ datasource, packageName: 'no_links' });
      expect(res).toEqual({
        registryUrl: 'https://hex.pm',
        releases: [
          { version: '1.0.0', releaseTimestamp: '2021-08-04T15:26:26.500Z' },
        ],
      });
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

      hostRules.add({
        authType: 'Token-Only',
        token: 'abc',
      });

      const result = await getPkgReleases({
        datasource,
        packageName: 'private_package:renovate_test',
      });

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

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'some_package',
          registryUrls: [customRegistryUrl],
        }),
      ).resolves.toBeNull();
    });

    it('returns null for network error', async () => {
      httpMock
        .scope(customRegistryUrl)
        .get('/packages/some_package')
        .replyWithError('connection refused');

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'some_package',
          registryUrls: [customRegistryUrl],
        }),
      ).resolves.toBeNull();
    });

    it('returns null for malformed gzip', async () => {
      httpMock
        .scope(customRegistryUrl)
        .get('/packages/bad_package')
        .reply(200, Buffer.from('not-gzip-data'));

      await expect(
        getPkgReleases({
          datasource,
          packageName: 'bad_package',
          registryUrls: [customRegistryUrl],
        }),
      ).resolves.toBeNull();
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

    it('returns null for missing signature when public key is available', async () => {
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
        { signature: Buffer.alloc(0) },
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

    it('returns null for malformed public key when verification is enabled', async () => {
      const v2Body = await makeV2Response({
        name: 'my_package',
        repository: 'custom',
        releases: [
          {
            version: '1.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      mockPublicKey(customRegistryUrl, 'not-a-valid-public-key');

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

    it('falls back to unsigned payload when public key response is empty', async () => {
      const v2Body = await makeV2Response({
        name: 'my_package',
        repository: 'custom',
        releases: [
          {
            version: '1.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      mockPublicKey(customRegistryUrl, '    ');

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

    it('uses pinned Hex public key for repo.hex.pm', async () => {
      const defaultV2RegistryUrl = 'https://repo.hex.pm';
      const v2Body = await makeV2Response({
        name: 'my_package',
        repository: 'hexpm',
        releases: [
          {
            version: '1.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      httpMock
        .scope(defaultV2RegistryUrl)
        .get('/packages/my_package')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'my_package',
        registryUrls: [defaultV2RegistryUrl],
      });

      expect(result).toBeNull();
    });

    it('maps repo.hex.pm host aliases to hexpm repository checks', async () => {
      const hostAliasRegistryUrl = 'https://repo.hex.pm:443';
      const v2Body = await makeV2Response({
        name: 'my_package',
        repository: 'hexpm',
        releases: [
          {
            version: '1.0.0',
            innerChecksum: new Uint8Array(),
            dependencies: [],
          },
        ],
      });

      mockPublicKeyUnavailable(hostAliasRegistryUrl);

      httpMock
        .scope(hostAliasRegistryUrl)
        .get('/packages/my_package')
        .reply(200, v2Body);

      const result = await getPkgReleases({
        datasource,
        packageName: 'my_package',
        registryUrls: [hostAliasRegistryUrl],
      });

      expect(result).toEqual({
        registryUrl: hostAliasRegistryUrl,
        releases: [{ version: '1.0.0' }],
      });
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
