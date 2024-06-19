import { mockDeep } from 'jest-mock-extended';
import { GetPkgReleasesConfig, getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { hostRules } from '../../../../test/util';
import { HexDatasource } from '.';

const tlsCertificateCheckAPIResponse = Fixtures.get(
  'tls_certificate_check.json',
);

const tlsCertificateCheckRegistryResponse = Fixtures.getBinary(
  'tls_certificate_check.bin.gz',
);

jest.mock('../../../util/host-rules', () => mockDeep());

const baseHexpmUrl = 'https://hex.pm/api';
const baseRegistryUrl = 'https://repo.hex.pm';
const privateBaseRegistryUrl = 'https://getoban.pro/repo';
const datasource = HexDatasource.id;
let config: GetPkgReleasesConfig;

describe('modules/datasource/hex/index', () => {
  beforeEach(() => {
    hostRules.hosts.mockReturnValue([]);
    hostRules.find.mockReturnValue({});
    config = {
      datasource,
      packageName: 'replace',
    };
  });

  describe('getReleases', () => {
    it('returns null for 404', async () => {
      httpMock.scope(baseRegistryUrl).get('/packages/some_package').reply(404);
      expect(
        await getPkgReleases({ ...config, packageName: 'some_package' }),
      ).toBeNull();
    });

    it('returns null for 401', async () => {
      httpMock.scope(baseRegistryUrl).get('/packages/some_package').reply(401);
      expect(
        await getPkgReleases({ ...config, packageName: 'some_package' }),
      ).toBeNull();
    });

    // do we have to throw for for >401 responses? Don't see this elsewhere
    // it('throws for 429', async () => {
    //   httpMock.scope(baseRegistryUrl).get('/packages/some_crate').reply(429);
    //   await expect(
    //     getPkgReleases({ datasource, packageName: 'some_crate' }),
    //   ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    // });
    // it('throws for 429', async () => {
    //   httpMock.scope(baseUrl).get('/packages/some_crate').reply(429);
    //   await expect(
    //     getPkgReleases({ datasource, packageName: 'some_crate' }),
    //   ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    // });
    // it('throws for 5xx', async () => {
    //   httpMock.scope(baseUrl).get('/packages/some_crate').reply(502);
    //   await expect(
    //     getPkgReleases({ datasource, packageName: 'some_crate' }),
    //   ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    // });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/some_package')
        .replyWithError('');
      expect(
        await getPkgReleases({ ...config, packageName: 'some_package' }),
      ).toBeNull();
    });

    it('returns null with wrong auth token', async () => {
      httpMock
        .scope(baseRegistryUrl, {
          reqheaders: {
            authorization: 'abc',
          },
        })
        .get('/packages/tls_certificate_check')
        .reply(401);

      hostRules.find.mockReturnValueOnce({
        authType: 'Token-Only',
        token: 'abc',
      });

      const res = await getPkgReleases({
        ...config,
        packageName: 'tls_certificate_check',
      });

      expect(res).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/tls_certificate_check')
        .reply(200, tlsCertificateCheckRegistryResponse);

      httpMock
        .scope(baseHexpmUrl)
        .get('/packages/tls_certificate_check')
        .reply(200, tlsCertificateCheckAPIResponse);

      const res = await getPkgReleases({
        ...config,
        packageName: 'tls_certificate_check',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('process public repo without auth', async () => {
      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/tls_certificate_check')
        .reply(200, tlsCertificateCheckRegistryResponse);

      httpMock
        .scope(baseHexpmUrl)
        .get('/packages/tls_certificate_check')
        .reply(200, tlsCertificateCheckAPIResponse);

      hostRules.find.mockReturnValueOnce({});
      const res = await getPkgReleases({
        ...config,
        packageName: 'tls_certificate_check',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('extracts deprecated info', async () => {
      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/tls_certificate_check')
        .reply(200, tlsCertificateCheckRegistryResponse);

      httpMock
        .scope(baseHexpmUrl)
        .get('/packages/tls_certificate_check')
        .reply(200, tlsCertificateCheckAPIResponse);

      hostRules.find.mockReturnValueOnce({});
      const res = await getPkgReleases({
        ...config,
        packageName: 'tls_certificate_check',
      });
      expect(res?.releases.some((rel) => rel.isDeprecated)).toBeTrue();
    });

    it('processes a private organization repo with auth', async () => {
      httpMock
        .scope(baseRegistryUrl, {
          reqheaders: {
            authorization: 'abc',
          },
        })
        .get('/repos/private_org/packages/tls_certificate_check')
        .reply(200, tlsCertificateCheckRegistryResponse);

      httpMock
        .scope(baseHexpmUrl, {
          reqheaders: {
            authorization: 'abc',
          },
        })
        .get('/repos/private_org/packages/tls_certificate_check')
        .reply(200, tlsCertificateCheckAPIResponse);

      hostRules.find.mockReturnValue({
        authType: 'Token-Only',
        token: 'abc',
      });
      const result = await getPkgReleases({
        ...config,
        packageName: 'org:private_org:tls_certificate_check',
      });

      expect(result).not.toBeNull();
    });

    // repo tests
    it('processes a private repo with auth', async () => {
      httpMock
        .scope(privateBaseRegistryUrl, {
          reqheaders: {
            authorization: 'abc',
          },
        })
        .get('/packages/tls_certificate_check')
        .reply(200, tlsCertificateCheckRegistryResponse);
      hostRules.find.mockReturnValueOnce({
        authType: 'Token-Only',
        token: 'abc',
      });
      const result = await getPkgReleases({
        ...config,
        packageName: 'repo:private_repo:tls_certificate_check',
        registryUrls: ['https://getoban.pro/repo'],
      });
      expect(result).not.toBeNull();
    });
  });
});
