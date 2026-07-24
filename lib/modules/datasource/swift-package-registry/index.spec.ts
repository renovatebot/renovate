import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { getPkgReleases } from '../index.ts';
import { SwiftPackageRegistryDatasource } from './index.ts';

const datasource = SwiftPackageRegistryDatasource.id;

const baseUrl = 'https://registry.example.com';
const packageName = 'acme.somelib';

const acceptHeader = 'application/vnd.swift.registry.v1+json';

const happyBody = {
  releases: {
    '1.0.0': { url: `${baseUrl}/acme/somelib/1.0.0` },
    '1.1.0': { url: `${baseUrl}/acme/somelib/1.1.0` },
    '2.0.0': { url: `${baseUrl}/acme/somelib/2.0.0` },
  },
};

describe('modules/datasource/swift-package-registry/index', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  describe('getReleases', () => {
    it('returns null when no registryUrls supplied', async () => {
      expect(
        await getPkgReleases({
          datasource,
          packageName,
        }),
      ).toBeNull();
    });

    it('returns null when packageName has no scope separator', async () => {
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'invalidIdentity',
          registryUrls: [baseUrl],
        }),
      ).toBeNull();
    });

    it('returns null when packageName starts or ends with the separator', async () => {
      expect(
        await getPkgReleases({
          datasource,
          packageName: '.somelib',
          registryUrls: [baseUrl],
        }),
      ).toBeNull();
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'acme.',
          registryUrls: [baseUrl],
        }),
      ).toBeNull();
    });

    it('parses a happy-path SE-0292 response', async () => {
      httpMock
        .scope(baseUrl, { reqheaders: { accept: acceptHeader } })
        .get('/acme/somelib')
        .reply(200, happyBody);
      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [baseUrl],
      });
      expect(res?.releases.map((r) => r.version)).toEqual([
        '1.0.0',
        '1.1.0',
        '2.0.0',
      ]);
    });

    it('skips releases carrying a problem block', async () => {
      httpMock
        .scope(baseUrl)
        .get('/acme/somelib')
        .reply(200, {
          releases: {
            '1.0.0': { url: `${baseUrl}/acme/somelib/1.0.0` },
            '1.1.0': {
              problem: {
                status: 410,
                title: 'Gone',
                detail: 'Release retracted',
              },
            },
            '2.0.0': { url: `${baseUrl}/acme/somelib/2.0.0` },
          },
        });
      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [baseUrl],
      });
      expect(res?.releases.map((r) => r.version)).toEqual(['1.0.0', '2.0.0']);
    });

    it('returns null when releases map is empty', async () => {
      httpMock.scope(baseUrl).get('/acme/somelib').reply(200, { releases: {} });
      expect(
        await getPkgReleases({
          datasource,
          packageName,
          registryUrls: [baseUrl],
        }),
      ).toBeNull();
    });

    it('returns null when every release is retracted', async () => {
      httpMock
        .scope(baseUrl)
        .get('/acme/somelib')
        .reply(200, {
          releases: {
            '1.0.0': { problem: { status: 410, title: 'Gone' } },
          },
        });
      expect(
        await getPkgReleases({
          datasource,
          packageName,
          registryUrls: [baseUrl],
        }),
      ).toBeNull();
    });

    it('returns null when response shape does not match SE-0292', async () => {
      httpMock
        .scope(baseUrl)
        .get('/acme/somelib')
        .reply(200, { not: 'a swift registry response' });
      expect(
        await getPkgReleases({
          datasource,
          packageName,
          registryUrls: [baseUrl],
        }),
      ).toBeNull();
    });

    it('returns null when the releases entries fail zod validation', async () => {
      // Each release entry's `url` must be a string per the schema; a number
      // forces safeParse to fail rather than coerce.
      httpMock
        .scope(baseUrl)
        .get('/acme/somelib')
        .reply(200, { releases: { '1.0.0': { url: 12345 } } });
      expect(
        await getPkgReleases({
          datasource,
          packageName,
          registryUrls: [baseUrl],
        }),
      ).toBeNull();
    });

    it('returns null on 404', async () => {
      httpMock.scope(baseUrl).get('/acme/somelib').reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName,
          registryUrls: [baseUrl],
        }),
      ).toBeNull();
    });

    it('throws ExternalHostError on 5xx', async () => {
      httpMock.scope(baseUrl).get('/acme/somelib').reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName,
          registryUrls: [baseUrl],
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null on connection error', async () => {
      httpMock.scope(baseUrl).get('/acme/somelib').replyWithError('boom');
      expect(
        await getPkgReleases({
          datasource,
          packageName,
          registryUrls: [baseUrl],
        }),
      ).toBeNull();
    });

    it('hunts across multiple registryUrls and accepts the first 200', async () => {
      const secondaryUrl = 'https://registry.example.org';
      httpMock.scope(baseUrl).get('/acme/somelib').reply(404);
      httpMock.scope(secondaryUrl).get('/acme/somelib').reply(200, happyBody);
      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [baseUrl, secondaryUrl],
      });
      expect(res?.releases.map((r) => r.version)).toEqual([
        '1.0.0',
        '1.1.0',
        '2.0.0',
      ]);
    });

    it('sends a Bearer Authorization header when hostRules supply a token', async () => {
      hostRules.add({
        hostType: SwiftPackageRegistryDatasource.id,
        matchHost: 'registry.example.com',
        token: 's3cret',
      });
      httpMock
        .scope(baseUrl, {
          reqheaders: {
            authorization: 'Bearer s3cret',
            accept: acceptHeader,
          },
        })
        .get('/acme/somelib')
        .reply(200, happyBody);
      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [baseUrl],
      });
      expect(res?.releases).toHaveLength(3);
    });

    it('sends Basic auth when hostRules supply username and password', async () => {
      hostRules.add({
        hostType: SwiftPackageRegistryDatasource.id,
        matchHost: 'registry.example.com',
        username: 'ci',
        password: 'p4ss',
      });
      const expected = `Basic ${Buffer.from('ci:p4ss').toString('base64')}`;
      httpMock
        .scope(baseUrl, {
          reqheaders: {
            authorization: expected,
            accept: acceptHeader,
          },
        })
        .get('/acme/somelib')
        .reply(200, happyBody);
      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [baseUrl],
      });
      expect(res?.releases).toHaveLength(3);
    });

    it('handles a trailing slash on the registryUrl', async () => {
      httpMock.scope(baseUrl).get('/acme/somelib').reply(200, happyBody);
      const res = await getPkgReleases({
        datasource,
        packageName,
        registryUrls: [`${baseUrl}/`],
      });
      expect(res?.releases).toHaveLength(3);
    });
  });
});
