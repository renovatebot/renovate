import fs from 'fs';
import _got from '../../util/got';
import { getPkgReleases, getRepositoryData } from '.';

const got: any = _got;

// Truncated index.yaml file
const indexYaml = fs.readFileSync(
  'lib/datasource/helm/__fixtures__/index.yaml',
  'utf8'
);

jest.mock('../../util/got');

describe('datasource/helm', () => {
  describe('getPkgReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      global.repoCache = {};
      return global.renovateCache.rmAll();
    });
    it('returns null if lookupName was not provided', async () => {
      expect(
        await getPkgReleases({
          lookupName: undefined,
          registryUrls: ['example-repository.com'],
        })
      ).toBeNull();
    });
    it('returns null if repository was not provided', async () => {
      expect(
        await getPkgReleases({
          lookupName: 'some_chart',
          registryUrls: [],
        })
      ).toBeNull();
    });
    it('returns null for empty response', async () => {
      got.mockReturnValueOnce(null);
      expect(
        await getPkgReleases({
          lookupName: 'non_existent_chart',
          registryUrls: ['example-repository.com'],
        })
      ).toBeNull();
    });
    it('returns null for missing response body', async () => {
      got.mockReturnValueOnce({
        body: undefined,
      });
      expect(
        await getPkgReleases({
          lookupName: 'non_existent_chart',
          registryUrls: ['example-repository.com'],
        })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await getPkgReleases({
          lookupName: 'some_chart',
          registryUrls: ['example-repository.com'],
        })
      ).toBeNull();
    });
    it('throws for 5xx', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 502,
        })
      );
      let e;
      try {
        await getPkgReleases({
          lookupName: 'some_chart',
          registryUrls: ['example-repository.com'],
        });
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await getPkgReleases({
          lookupName: 'some_chart',
          registryUrls: ['example-repository.com'],
        })
      ).toBeNull();
    });
    it('returns null if index.yaml in response is empty', async () => {
      const res = { body: '# A comment' };
      got.mockReturnValueOnce(res);
      const releases = await getPkgReleases({
        lookupName: 'non_existent_chart',
        registryUrls: ['example-repository.com'],
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
      got.mockReturnValueOnce(res);
      const releases = await getPkgReleases({
        lookupName: 'non_existent_chart',
        registryUrls: ['example-repository.com'],
      });
      expect(releases).toBeNull();
    });
    it('returns null if lookupName is not in index.yaml', async () => {
      got.mockReturnValueOnce({ body: indexYaml });
      const releases = await getPkgReleases({
        lookupName: 'non_existent_chart',
        registryUrls: ['example-repository.com'],
      });
      expect(releases).toBeNull();
    });
    it('returns list of versions for normal response if index.yaml is not cached', async () => {
      got.mockReturnValueOnce({ body: indexYaml });
      const releases = await getPkgReleases({
        lookupName: 'ambassador',
        registryUrls: ['example-repository.com'],
      });
      expect(releases).not.toBeNull();
      expect(releases).toMatchSnapshot();
    });
    it('returns list of versions for normal response if index.yaml is cached', async () => {
      const repository = 'example-repository.com';
      const cacheNamespace = 'datasource-helm';
      const cacheKey = repository;
      const cacheMinutes = 10;
      got.mockReturnValueOnce({ body: indexYaml });
      const repositoryData = await getRepositoryData(repository);
      await global.renovateCache.set(
        cacheNamespace,
        cacheKey,
        repositoryData,
        cacheMinutes
      );
      const releases = await getPkgReleases({
        lookupName: 'ambassador',
        registryUrls: [repository],
      });
      expect(releases).not.toBeNull();
      expect(releases).toMatchSnapshot();
    });
  });
});
