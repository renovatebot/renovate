import { mockDeep } from 'jest-mock-extended';
import type { GetPkgReleasesConfig } from '..';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { hostRules } from '../../../../test/util';
import { HexDatasource } from '.';

const renovateTestPackageAPIResponse = Fixtures.get(
  'renovate_test_package.json',
);

const renovateTestPackageRegistryResponse = Fixtures.getBinary(
  'renovate_test_package.bin.gz',
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
        .get('/packages/renovate_test_package')
        .reply(401);

      hostRules.find.mockReturnValueOnce({
        authType: 'Token-Only',
        token: 'abc',
      });

      const res = await getPkgReleases({
        ...config,
        packageName: 'renovate_test_package',
      });

      expect(res).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/renovate_test_package')
        .reply(200, renovateTestPackageRegistryResponse);

      httpMock
        .scope(baseHexpmUrl)
        .get('/packages/renovate_test_package')
        .reply(200, renovateTestPackageAPIResponse);

      const res = await getPkgReleases({
        ...config,
        packageName: 'renovate_test_package',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('returns null for public repo with error', async () => {
      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/renovate_test_package')
        .reply(200, renovateTestPackageRegistryResponse);

      httpMock
        .scope(baseHexpmUrl)
        .get('/packages/renovate_test_package')
        .replyWithError('error');

      expect(
        await getPkgReleases({
          ...config,
          packageName: 'renovate_test_package',
        }),
      ).toBeNull();
    });

    it('returns null for public repo with buffer error', async () => {
      const invalidBuffer = Buffer.from('invalid compressed data');

      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/renovate_test_package')
        .reply(200, invalidBuffer);

      expect(
        await getPkgReleases({
          ...config,
          packageName: 'renovate_test_package',
        }),
      ).toBeNull();
    });

    it('returns null for 500 response', async () => {
      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/renovate_test_package')
        .reply(500);

      expect(
        await getPkgReleases({
          ...config,
          packageName: 'renovate_test_package',
        }),
      ).toBeNull();
    });

    it('process public repo without auth', async () => {
      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/renovate_test_package')
        .reply(200, renovateTestPackageRegistryResponse);

      httpMock
        .scope(baseHexpmUrl)
        .get('/packages/renovate_test_package')
        .reply(200, renovateTestPackageAPIResponse);

      hostRules.find.mockReturnValueOnce({});
      const res = await getPkgReleases({
        ...config,
        packageName: 'renovate_test_package',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(res).toBeDefined();
    });

    it('extracts deprecated info', async () => {
      httpMock
        .scope(baseRegistryUrl)
        .get('/packages/renovate_test_package')
        .reply(200, renovateTestPackageRegistryResponse);

      httpMock
        .scope(baseHexpmUrl)
        .get('/packages/renovate_test_package')
        .reply(200, renovateTestPackageAPIResponse);

      hostRules.find.mockReturnValueOnce({});
      const res = await getPkgReleases({
        ...config,
        packageName: 'renovate_test_package',
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
        .get('/repos/private_org/packages/renovate_test_package')
        .reply(200, renovateTestPackageRegistryResponse);

      httpMock
        .scope(baseHexpmUrl, {
          reqheaders: {
            authorization: 'abc',
          },
        })
        .get('/repos/private_org/packages/renovate_test_package')
        .reply(200, renovateTestPackageAPIResponse);

      hostRules.find.mockReturnValue({
        authType: 'Token-Only',
        token: 'abc',
      });
      const result = await getPkgReleases({
        ...config,
        packageName: 'org:private_org:renovate_test_package',
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
        .get('/packages/renovate_test_package')
        .reply(200, renovateTestPackageRegistryResponse);
      hostRules.find.mockReturnValueOnce({
        authType: 'Token-Only',
        token: 'abc',
      });
      const result = await getPkgReleases({
        ...config,
        packageName: 'repo:private_repo:renovate_test_package',
        registryUrls: ['https://getoban.pro/repo'],
      });
      expect(result).not.toBeNull();
    });
  });
});
