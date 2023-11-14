import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import * as hostRules from '../../../util/host-rules';
import { PypiDatasource } from '.';

const res1 = Fixtures.get('azure-cli-monitor.json');
const res2 = Fixtures.get('azure-cli-monitor-updated.json');
const htmlResponse = Fixtures.get('versions-html.html');
const badResponse = Fixtures.get('versions-html-badfile.html');
const dataRequiresPythonResponse = Fixtures.get(
  'versions-html-data-requires-python.html',
);
const mixedHyphensResponse = Fixtures.get('versions-html-mixed-hyphens.html');
const mixedCaseResponse = Fixtures.get('versions-html-mixed-case.html');
const withPeriodsResponse = Fixtures.get('versions-html-with-periods.html');
const hyphensResponse = Fixtures.get('versions-html-hyphens.html');

const baseUrl = 'https://pypi.org/pypi';
const datasource = PypiDatasource.id;

describe('modules/datasource/pypi/index', () => {
  describe('getReleases', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV };
      delete process.env.PIP_INDEX_URL;
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).get('/something/json').reply(200);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'something',
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/something/json').reply(404);
      httpMock.scope(baseUrl).get('/something/').reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'something',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock.scope(baseUrl).get('/azure-cli-monitor/json').reply(200, res1);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'azure-cli-monitor',
        }),
      ).toMatchSnapshot();
    });

    it('supports custom datasource url', async () => {
      httpMock
        .scope('https://custom.pypi.net/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, res1);
      const config = {
        registryUrls: ['https://custom.pypi.net/foo'],
      };
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          packageName: 'azure-cli-monitor',
        }),
      ).toMatchObject({
        registryUrl: 'https://custom.pypi.net/foo',
        releases: expect.toBeArrayOfSize(22),
        sourceUrl: 'https://github.com/Azure/azure-cli',
      });
    });

    it('sets private if authorization privided', async () => {
      hostRules.add({ matchHost: 'customprivate.pypi.net', token: '123test' });
      httpMock
        .scope('https://customprivate.pypi.net/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, res1);
      const config = {
        registryUrls: ['https://customprivate.pypi.net/foo'],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
        packageName: 'azure-cli-monitor',
      });
      expect(res?.isPrivate).toBeTrue();
    });

    it('supports multiple custom datasource urls', async () => {
      httpMock
        .scope('https://custom.pypi.net/foo')
        .get('/azure-cli-monitor/json')
        .replyWithError('error');
      httpMock
        .scope('https://second-index/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, res1);
      httpMock
        .scope('https://third-index/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, res2);
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
        packageName: 'azure-cli-monitor',
      });
      expect(res?.releases.pop()).toMatchObject({
        version: '0.2.15',
        releaseTimestamp: '2019-06-18T13:58:55.000Z',
      });
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
            packageName: 'something',
          })
        )?.homepage,
      ).toBe('https://microsoft.com');
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
        packageName: 'flexget',
      });
      expect(result?.sourceUrl).toBe(info.project_urls.Repository);
      expect(result?.changelogUrl).toBe(info.project_urls.changelog);
    });

    it('excludes gh sponsors url from project_urls', async () => {
      const info = {
        name: 'flexget',
        home_page: 'https://flexget.com',
        project_urls: {
          random: 'https://github.com/sponsors/Flexget',
        },
      };
      httpMock
        .scope(baseUrl)
        .get('/flexget/json')
        .reply(200, { ...JSON.parse(res1), info });
      const result = await getPkgReleases({
        datasource,
        packageName: 'flexget',
      });
      expect(result?.sourceUrl).toBeUndefined();
    });

    it('normalizes the package name according to PEP 503', async () => {
      const expectedHttpCall = httpMock
        .scope(baseUrl)
        .get('/not-normalized-package/json')
        .reply(200, htmlResponse);

      await getPkgReleases({
        datasource,
        registryUrls: [baseUrl],
        packageName: 'not_normalized.Package',
      });

      expect(expectedHttpCall.isDone()).toBeTrue();
    });

    it('normalizes the package name according to PEP 503 when falling back to simple endpoint', async () => {
      httpMock
        .scope(baseUrl)
        .get('/not-normalized-package/json')
        .reply(404, '');
      const expectedFallbackHttpCall = httpMock
        .scope(baseUrl)
        .get('/not-normalized-package/')
        .reply(200, htmlResponse);

      await getPkgReleases({
        datasource,
        registryUrls: [baseUrl],
        packageName: 'not_normalized.Package',
      });

      expect(expectedFallbackHttpCall.isDone()).toBeTrue();
    });

    it('normalizes the package name according to PEP 503 querying a simple endpoint', async () => {
      const simpleRegistryUrl = 'https://some.registry.org/simple/';
      const expectedHttpCall = httpMock
        .scope(simpleRegistryUrl)
        .get('/not-normalized-package/')
        .reply(200, htmlResponse);

      await getPkgReleases({
        datasource,
        registryUrls: [simpleRegistryUrl],
        packageName: 'not_normalized.Package',
      });

      expect(expectedHttpCall.isDone()).toBeTrue();
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
          packageName: 'doit',
          constraintsFiltering: 'strict',
        }),
      ).toMatchSnapshot();
    });

    it('process data from simple endpoint', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, htmlResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'dj-database-url',
        }),
      ).toMatchSnapshot();
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
          packageName: 'dj-database-url',
        }),
      ).toMatchSnapshot();
    });

    it('sets private simple if authorization provided', async () => {
      hostRules.add({
        matchHost: 'some.private.registry.org',
        token: '123test',
      });
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
        packageName: 'dj-database-url',
      });
      expect(res?.isPrivate).toBeTrue();
    });

    it('process data from simple endpoint with hyphens', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/package-with-hyphens/')
        .reply(200, hyphensResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'package--with-hyphens',
      });
      expect(res?.releases).toMatchObject([
        { version: '2.0.0' },
        { version: '2.0.1' },
        { version: '2.0.2' },
      ]);
    });

    it('process data from simple endpoint with hyphens replaced with underscores', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/image-collector/')
        .reply(200, mixedHyphensResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'image-collector',
        }),
      ).toMatchSnapshot();
    });

    it('process data from simple endpoint with mixed-case characters', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/packagewithmixedcase/')
        .reply(200, mixedCaseResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'PackageWithMixedCase',
      });
      expect(res?.releases).toMatchObject([
        { version: '2.0.0' },
        { version: '2.0.1' },
        { version: '2.0.2' },
      ]);
    });

    it('process data from simple endpoint with mixed-case characters when using lower case dependency name', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/packagewithmixedcase/')
        .reply(200, mixedCaseResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'packagewithmixedcase',
      });
      expect(res?.releases).toMatchObject([
        { version: '2.0.0' },
        { version: '2.0.1' },
        { version: '2.0.2' },
      ]);
    });

    it('process data from simple endpoint with periods', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/package-with-periods/')
        .reply(200, withPeriodsResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'package.with.periods',
      });
      expect(res?.releases).toMatchObject([
        { version: '2.0.0' },
        { version: '2.0.1' },
        { version: '2.0.2' },
      ]);
    });

    it('returns null for empty response', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'dj-database-url',
        }),
      ).toBeNull();
    });

    it('returns null for 404 response from simple endpoint', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .replyWithError('error');
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'dj-database-url',
        }),
      ).toBeNull();
    });

    it('returns null for response with no versions', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, badResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'dj-database-url',
        }),
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
        packageName: 'dj-database-url',
      });
      expect(result).toMatchSnapshot();
    });

    it('parses data-requires-python and respects constraints from simple endpoint', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, dataRequiresPythonResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      expect(
        await getPkgReleases({
          datasource,
          constraints: { python: '2.7' },
          ...config,
          packageName: 'dj-database-url',
          constraintsFiltering: 'strict',
        }),
      ).toMatchSnapshot();
    });
  });

  it('uses https://pypi.org/pypi/ instead of https://pypi.org/simple/', async () => {
    httpMock.scope(baseUrl).get('/azure-cli-monitor/json').reply(200, res1);
    const config = {
      registryUrls: ['https://pypi.org/simple/'],
    };
    expect(
      await getPkgReleases({
        datasource,
        ...config,
        constraints: { python: '2.7' },
        packageName: 'azure-cli-monitor',
      }),
    ).toMatchSnapshot();
  });
});
