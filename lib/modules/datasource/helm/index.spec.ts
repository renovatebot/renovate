import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { HelmDatasource } from '.';

// Truncated index.yaml file
const indexYaml = Fixtures.get('index.yaml');

describe('modules/datasource/helm/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns null if packageName was not provided', async () => {
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          depName: undefined as never, // #7154
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });

    it('returns null if repository was not provided', async () => {
      // FIXME: should it call default rtegisty?
      httpMock
        .scope('https://charts.helm.sh')
        .get('/stable/index.yaml')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          depName: 'some_chart',
          registryUrls: [],
        })
      ).toBeNull();
    });

    it('returns null for empty response', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200);
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          depName: 'non_existent_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });

    it('returns null for missing response body', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, undefined);
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          depName: 'non_existent_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          depName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(502);
      await expect(
        getPkgReleases({
          datasource: HelmDatasource.id,
          depName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .replyWithError('');
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          depName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });

    it('returns null if index.yaml in response is empty', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, '# A comment');
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        depName: 'non_existent_chart',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toBeNull();
    });

    it('returns null if index.yaml in response is invalid', async () => {
      const res = {
        body: `some
                     invalid:
                     [
                     yaml`,
      };
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, res);
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        depName: 'non_existent_chart',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toBeNull();
    });

    it('returns null if packageName is not in index.yaml', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, indexYaml);
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        depName: 'non_existent_chart',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).toBeNull();
    });

    it('returns list of versions for normal response', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, indexYaml);
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        depName: 'ambassador',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).not.toBeNull();
      expect(releases).toMatchSnapshot();
    });

    it('adds trailing slash to subdirectories', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/subdir/index.yaml')
        .reply(200, indexYaml);
      const res = await getPkgReleases({
        datasource: HelmDatasource.id,
        depName: 'ambassador',
        registryUrls: ['https://example-repository.com/subdir'],
      });

      expect(res).toMatchObject({
        homepage: 'https://www.getambassador.io/',
        registryUrl: 'https://example-repository.com/subdir',
        sourceUrl: 'https://github.com/datawire/ambassador',
        releases: expect.toBeArrayOfSize(27),
      });
    });
  });
});
