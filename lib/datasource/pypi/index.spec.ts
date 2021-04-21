import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import * as hostRules from '../../util/host-rules';
import { id as datasource } from '.';

const res1: any = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/azure-cli-monitor.json'
);
const res2: any = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/azure-cli-monitor-updated.json'
);
const htmlResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html.html'
);
const badResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html-badfile.html'
);
const dataRequiresPythonResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html-data-requires-python.html'
);
const mixedHyphensResponse = fs.readFileSync(
  'lib/datasource/pypi/__fixtures__/versions-html-mixed-hyphens.html'
);

const baseUrl = 'https://pypi.org/pypi';

describe(getName(__filename), () => {
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
        await getPkgReleases({
          datasource,
          depName: 'something',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/something/json').reply(404);
      httpMock.scope(baseUrl).get('/something/').reply(404);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'something',
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
        await getPkgReleases({
          datasource,
          depName: 'azure-cli-monitor',
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
      await getPkgReleases({
        ...config,
        datasource,
        depName: 'azure-cli-monitor',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('sets private if authorization privided', async () => {
      hostRules.add({ hostName: 'customprivate.pypi.net', token: 'abc123' });
      httpMock
        .scope('https://customprivate.pypi.net/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, JSON.parse(res1));
      const config = {
        registryUrls: ['https://customprivate.pypi.net/foo'],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
        depName: 'azure-cli-monitor',
      });
      expect(res.isPrivate).toBe(true);
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
      httpMock
        .scope('https://third-index/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, JSON.parse(res2));
      const config = {
        registryUrls: [
          'https://custom.pypi.net/foo',
          'https://second-index/foo',
          'https://third-index/foo',
        ],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
        depName: 'azure-cli-monitor',
      });
      expect(res.releases.pop()).toMatchObject({
        version: '0.2.15',
        releaseTimestamp: '2019-06-18T13:58:55.000Z',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns non-github home_page', async () => {
      httpMock
        .scope(baseUrl)
        .get('/something/json')
        .reply(200, {
          ...JSON.parse(res1),
          info: {
            name: 'something',
            home_page: 'https://microsoft.com',
          },
        });
      expect(
        (
          await getPkgReleases({
            datasource,
            depName: 'something',
          })
        ).homepage
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
      httpMock
        .scope(baseUrl)
        .get('/flexget/json')
        .reply(200, { ...JSON.parse(res1), info });
      const result = await getPkgReleases({
        datasource,
        depName: 'flexget',
      });
      expect(result.sourceUrl).toBe(info.project_urls.Repository);
      expect(result.changelogUrl).toBe(info.project_urls.changelog);
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
        await getPkgReleases({
          datasource,
          depName: 'something',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('respects constraints', async () => {
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
            '0.4.1': [],
          },
        });
      expect(
        await getPkgReleases({
          datasource,
          constraints: { python: '2.7' },
          depName: 'doit',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('process data from simple endpoint', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/dj-database-url/')
        .reply(200, htmlResponse);
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          depName: 'dj-database-url',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('process data from +simple endpoint', async () => {
      httpMock
        .scope('https://some.registry.org/+simple/')
        .get('/dj-database-url/')
        .reply(200, htmlResponse);
      const config = {
        registryUrls: ['https://some.registry.org/+simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          depName: 'dj-database-url',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('sets private simple if authorization provided', async () => {
      hostRules.add({ hostName: 'some.private.registry.org', token: 'abc123' });
      httpMock
        .scope('https://some.private.registry.org/+simple/')
        .get('/dj-database-url/')
        .reply(200, htmlResponse);
      const config = {
        registryUrls: ['https://some.private.registry.org/+simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        constraints: { python: '2.7' },
        depName: 'dj-database-url',
      });
      expect(res.isPrivate).toBe(true);
    });
    it('process data from simple endpoint with hyphens replaced with underscores', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/image-collector/')
        .reply(200, mixedHyphensResponse);
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          depName: 'image-collector',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty response', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/dj-database-url/')
        .reply(200);
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          depName: 'dj-database-url',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404 response from simple endpoint', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/dj-database-url/')
        .replyWithError('error');
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          depName: 'dj-database-url',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for response with no versions', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/dj-database-url/')
        .reply(200, badResponse);
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          depName: 'dj-database-url',
        })
      ).toBeNull();
    });
    it('fall back from json and process data from simple endpoint', async () => {
      httpMock
        .scope('https://custom.pypi.net/foo')
        .get('/dj-database-url/json')
        .reply(404);
      httpMock
        .scope('https://custom.pypi.net/foo')
        .get('/dj-database-url/')
        .reply(200, htmlResponse);
      const config = {
        registryUrls: ['https://custom.pypi.net/foo'],
      };
      const result = await getPkgReleases({
        datasource,
        ...config,
        depName: 'dj-database-url',
      });
      expect(result).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('parses data-requires-python and respects constraints from simple endpoint', async () => {
      httpMock
        .scope('https://pypi.org/simple/')
        .get('/dj-database-url/')
        .reply(200, dataRequiresPythonResponse);
      const config = {
        registryUrls: ['https://pypi.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          constraints: { python: '2.7' },
          ...config,
          depName: 'dj-database-url',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
