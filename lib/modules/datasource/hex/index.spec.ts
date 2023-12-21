import { mockDeep } from 'jest-mock-extended';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { hostRules } from '../../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { HexDatasource } from '.';

const certifiResponse = Fixtures.get('certifi.json');
const privatePackageResponse = Fixtures.get('private_package.json');

jest.mock('../../../util/host-rules', () => mockDeep());

const baseUrl = 'https://hex.pm/api';
const datasource = HexDatasource.id;

describe('modules/datasource/hex/index', () => {
  beforeEach(() => {
    hostRules.hosts.mockReturnValue([]);
    hostRules.find.mockReturnValue({});
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
        registryUrl: 'https://hex.pm/',
        releases: [
          { releaseTimestamp: '2021-08-04T15:26:26.500Z', version: '0.1.0' },
          { releaseTimestamp: '2021-08-04T17:46:00.274Z', version: '0.1.1' },
        ],
      });
    });
  });
});
