import { getPkgReleases } from '..';
import { Fixtures } from '../../../test/fixtures';
import * as httpMock from '../../../test/http-mock';
import { HelmDatasource } from '.';

// Truncated index.yaml file
const indexYaml = Fixtures.get('index.yaml');

describe('datasource/helm/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns null if lookupName was not provided', async () => {
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          depName: undefined,
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
        .reply(200, null);
      expect(
        await getPkgReleases({
          datasource: HelmDatasource.id,
          depName: 'non_existent_chart',
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 5xx', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(502);
      let e;
      try {
        await getPkgReleases({
          datasource: HelmDatasource.id,
          depName: 'some_chart',
          registryUrls: ['https://example-repository.com'],
        });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null if lookupName is not in index.yaml', async () => {
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
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('adds trailing slash to subdirectories', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/subdir/index.yaml')
        .reply(200, indexYaml);
      await getPkgReleases({
        datasource: HelmDatasource.id,
        depName: 'ambassador',
        registryUrls: ['https://example-repository.com/subdir'],
      });
      const trace = httpMock.getTrace();
      expect(trace[0].url).toBe(
        'https://example-repository.com/subdir/index.yaml'
      );
      expect(trace).toMatchSnapshot();
    });
    it('returns home and source metadata of the most recent version', async () => {
      httpMock
        .scope('https://example-repository.com')
        .get('/index.yaml')
        .reply(200, indexYaml);
      const releases = await getPkgReleases({
        datasource: HelmDatasource.id,
        depName: 'cluster-autoscaler',
        registryUrls: ['https://example-repository.com'],
      });
      expect(releases).not.toBeNull();
      expect(releases).toMatchSnapshot();
    });
  });
});
