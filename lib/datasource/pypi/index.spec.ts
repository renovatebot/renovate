import fs from 'fs';
import * as httpMock from '../../../test/httpMock';
import * as pypi from '.';

const res1: any = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/azure-cli-monitor.json'
);
const htmlResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html.html'
);
const badResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html-badfile.html'
);
const mixedHyphensResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html-mixed-hyphens.html'
);

const baseUrl = 'https://pypi.org/pypi';

describe('datasource/pypi', () => {
  describe('getReleases', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV };
      delete process.env.PIP_INDEX_URL;
      httpMock.setup();
      jest.resetAllMocks();
    });

    afterEach(() => {
      process.env = OLD_ENV;
      httpMock.reset();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/something/json').reply(200);
      expect(
        await pypi.getReleases({
          lookupName: 'something',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/something/json').reply(404);
      expect(
        await pypi.getReleases({
          lookupName: 'something',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/azure-cli-monitor/json')
        .reply(200, JSON.parse(res1));
      expect(
        await pypi.getReleases({
          lookupName: 'azure-cli-monitor',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports custom datasource url', async () => {
      httpMock
        .scope('https://custom.pypi.net/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, JSON.parse(res1));
      const config = {
        registryUrls: ['https://custom.pypi.net/foo'],
      };
      await pypi.getReleases({
        ...config,
        lookupName: 'azure-cli-monitor',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('supports custom datasource url from environmental variable', async () => {
      httpMock
        .scope('https://my.pypi.python/pypi/')
        .get('/azure-cli-monitor/json')
        .reply(200, JSON.parse(res1));
      const pipIndexUrl = process.env.PIP_INDEX_URL;
      process.env.PIP_INDEX_URL = 'https://my.pypi.python/pypi/';
      await pypi.getReleases({
        lookupName: 'azure-cli-monitor',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
      process.env.PIP_INDEX_URL = pipIndexUrl;
    });
    it('supports multiple custom datasource urls', async () => {
      httpMock
        .scope('https://custom.pypi.net/foo')
        .get('/azure-cli-monitor/json')
        .replyWithError('error');
      httpMock
        .scope('https://second-index/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, JSON.parse(res1));
      const config = {
        registryUrls: [
          'https://custom.pypi.net/foo',
          'https://second-index/foo',
          'https://third-index/foo',
        ],
      };
      await pypi.getReleases({
        ...config,
        lookupName: 'azure-cli-monitor',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns non-github home_page', async () => {
      httpMock
        .scope(baseUrl)
        .get('/something/json')
        .reply(200, {
          info: {
            name: 'something',
            home_page: 'https://microsoft.com',
          },
        });
      expect(
        await pypi.getReleases({
          lookupName: 'something',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('find url from project_urls', async () => {
      const info = {
        name: 'flexget',
        home_page: 'https://flexget.com',
        project_urls: {
          Forum: 'https://discuss.flexget.com',
          Homepage: 'https://flexget.com',
          changelog: 'https://github.com/Flexget/wiki/blob/master/ChangeLog.md',
          'Issue Tracker': 'https://github.com/Flexget/Flexget/issues',
          Repository: 'https://github.com/Flexget/Flexget',
        },
      };
      httpMock.scope(baseUrl).get('/flexget/json').reply(200, { info });
      const result = await pypi.getReleases({
        lookupName: 'flexget',
      });
      expect(result.sourceUrl).toBe(info.project_urls.Repository);
      expect(result.changelogUrl).toBe(info.project_urls.changelog);
      expect(result).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null if mismatched name', async () => {
      httpMock
        .scope(baseUrl)
        .get('/something/json')
        .reply(200, {
          info: {
            name: 'something-else',
            home_page: 'https://microsoft.com',
          },
        });
      expect(
        await pypi.getReleases({
          lookupName: 'something',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('respects compatibility', async () => {
      httpMock
        .scope(baseUrl)
        .get('/doit/json')
        .reply(200, {
          info: {
            name: 'doit',
          },
          releases: {
            '0.30.3': [{ requires_python: null }],
            '0.31.0': [
              { requires_python: '>=3.4' },
              { requires_python: '>=2.7' },
            ],
            '0.31.1': [{ requires_python: '>=3.4' }],
            '0.4.0': [{ requires_python: '>=3.4' }, { requires_python: null }],
          },
        });
      expect(
        await pypi.getReleases({
          compatibility: { python: '2.7' },
          lookupName: 'doit',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('process data from simple endpoint', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/dj-database-url')
        .reply(200, htmlResponse + '');
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('process data from +simple endpoint', async () => {
      httpMock
        .scope('https://some.registry.org/+simple/')
        .get('/dj-database-url')
        .reply(200, htmlResponse + '');
      const config = {
        registryUrls: ['https://some.registry.org/+simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('process data from simple endpoint with hyphens replaced with underscores', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/image-collector')
        .reply(200, mixedHyphensResponse + '');
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'image-collector',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty response', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/dj-database-url')
        .reply(200);
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404 response from simple endpoint', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/dj-database-url')
        .replyWithError('error');
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for response with no versions', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/dj-database-url')
        .reply(200, badResponse + '');
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await pypi.getReleases({
          ...config,
          compatibility: { python: '2.7' },
          lookupName: 'dj-database-url',
        })
      ).toEqual({ releases: [] });
    });
  });
});
