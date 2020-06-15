import fs from 'fs';
import * as httpMock from '../../../test/httpMock';
import { getReleases } from '.';

// Truncated index.yaml file
const indexYaml = fs.readFileSync(
  'lib/datasource/helm/__fixtures__/index.yaml',
  'utf8'
);

describe('datasource/helm', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('returns null if lookupName was not provided', async () => {
      expect(
        await getReleases({
          lookupName: undefined,
          registryUrls: ['https://example-repository.com'],
        })
      ).toBeNull();
    });
    it('returns null if repository was not provided', async () => {
      expect(
        await getReleases({
          lookupName: 'some_chart',
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
        await getReleases({
          lookupName: 'non_existent_chart',
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
        await getReleases({
          lookupName: 'non_existent_chart',
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
        await getReleases({
          lookupName: 'some_chart',
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
        await getReleases({
          lookupName: 'some_chart',
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
        await getReleases({
          lookupName: 'some_chart',
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
      const releases = await getReleases({
        lookupName: 'non_existent_chart',
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
      const releases = await getReleases({
        lookupName: 'non_existent_chart',
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
      const releases = await getReleases({
        lookupName: 'non_existent_chart',
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
      const releases = await getReleases({
        lookupName: 'ambassador',
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
      await getReleases({
        lookupName: 'ambassador',
        registryUrls: ['https://example-repository.com/subdir'],
      });
      const trace = httpMock.getTrace();
      expect(trace[0].url).toEqual(
        'https://example-repository.com/subdir/index.yaml'
      );
      expect(trace).toMatchSnapshot();
    });
  });
});
