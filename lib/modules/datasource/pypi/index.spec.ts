import { GoogleAuth as _googleAuth } from 'google-auth-library';
import { getPkgReleases } from '..';
import * as hostRules from '../../../util/host-rules';
import { PypiDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

vi.mock('google-auth-library');

const googleAuth = vi.mocked(_googleAuth);

const res1 = Fixtures.get('azure-cli-monitor.json');
const htmlResponse = Fixtures.get('versions-html.html');
const mixedCaseResponse = Fixtures.get('versions-html-mixed-case.html');
const withPeriodsResponse = Fixtures.get('versions-html-with-periods.html');

const azureCliMonitorReleases = [
  { releaseTimestamp: '2017-04-03T16:55:14.000Z', version: '0.0.1' },
  { releaseTimestamp: '2017-04-17T20:32:30.000Z', version: '0.0.2' },
  { releaseTimestamp: '2017-04-28T21:18:54.000Z', version: '0.0.3' },
  { releaseTimestamp: '2017-05-09T21:36:51.000Z', version: '0.0.4' },
  { releaseTimestamp: '2017-05-30T23:13:49.000Z', version: '0.0.5' },
  { releaseTimestamp: '2017-06-13T22:21:05.000Z', version: '0.0.6' },
  { releaseTimestamp: '2017-06-21T22:12:36.000Z', version: '0.0.7' },
  { releaseTimestamp: '2017-07-07T16:22:26.000Z', version: '0.0.8' },
  { releaseTimestamp: '2017-08-28T20:14:33.000Z', version: '0.0.9' },
  { releaseTimestamp: '2017-09-22T23:47:59.000Z', version: '0.0.10' },
  { releaseTimestamp: '2017-10-24T02:14:07.000Z', version: '0.0.11' },
  { releaseTimestamp: '2017-11-14T18:31:57.000Z', version: '0.0.12' },
  { releaseTimestamp: '2017-12-05T18:57:54.000Z', version: '0.0.13' },
  { releaseTimestamp: '2018-01-05T21:26:03.000Z', version: '0.0.14' },
  { releaseTimestamp: '2018-01-17T18:36:39.000Z', version: '0.1.0' },
  { releaseTimestamp: '2018-01-31T18:05:22.000Z', version: '0.1.1' },
  { releaseTimestamp: '2018-02-13T18:17:52.000Z', version: '0.1.2' },
  { releaseTimestamp: '2018-03-13T17:08:20.000Z', version: '0.1.3' },
  { releaseTimestamp: '2018-03-27T17:55:25.000Z', version: '0.1.4' },
  { releaseTimestamp: '2018-04-10T17:25:47.000Z', version: '0.1.5' },
  { releaseTimestamp: '2018-05-07T17:59:09.000Z', version: '0.1.6' },
  { releaseTimestamp: '2018-05-22T17:25:23.000Z', version: '0.1.7' },
  { releaseTimestamp: '2018-07-03T16:18:06.000Z', version: '0.1.8' },
  { releaseTimestamp: '2018-07-18T16:20:01.000Z', version: '0.2.0' },
  { releaseTimestamp: '2018-07-31T15:32:28.000Z', version: '0.2.1' },
  { releaseTimestamp: '2018-08-14T14:55:32.000Z', version: '0.2.2' },
  { releaseTimestamp: '2018-08-28T15:35:01.000Z', version: '0.2.3' },
  { releaseTimestamp: '2018-10-09T18:09:08.000Z', version: '0.2.4' },
  { releaseTimestamp: '2018-10-23T16:54:38.000Z', version: '0.2.5' },
  { releaseTimestamp: '2018-11-06T16:34:51.000Z', version: '0.2.6' },
  { releaseTimestamp: '2018-11-20T20:16:03.000Z', version: '0.2.7' },
  { releaseTimestamp: '2019-01-15T21:08:09.000Z', version: '0.2.8' },
  { releaseTimestamp: '2019-01-30T01:51:15.000Z', version: '0.2.9' },
  { releaseTimestamp: '2019-02-12T18:09:43.000Z', version: '0.2.10' },
  { releaseTimestamp: '2019-03-26T17:57:43.000Z', version: '0.2.11' },
  { releaseTimestamp: '2019-04-09T17:01:09.000Z', version: '0.2.12' },
  { releaseTimestamp: '2019-04-23T17:00:58.000Z', version: '0.2.13' },
  { releaseTimestamp: '2019-05-21T18:43:17.000Z', version: '0.2.14' },
  { releaseTimestamp: '2019-06-18T13:58:55.000Z', version: '0.2.15' },
];

const djDatabaseUrlSimpleReleases = [
  { version: '0.1.2' },
  { version: '0.1.3' },
  { version: '0.1.4' },
  { version: '0.2.0' },
  { version: '0.2.1' },
  { version: '0.2.2' },
  { version: '0.3.0' },
  { version: '0.4.0' },
  { version: '0.4.1' },
  { version: '0.4.2' },
  { isDeprecated: true, version: '0.5.0' },
];

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
        .scope('https://custom.pypi.net/foo')
        .get('/azure-cli-monitor/')
        .replyWithError('error');
      httpMock
        .scope('https://second-index/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, res1);
      httpMock
        .scope('https://third-index/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, Fixtures.get('azure-cli-monitor-updated.json'));
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

    it('supports Google Auth', async () => {
      httpMock
        .scope('https://someregion-python.pkg.dev/some-project/some-repo/')
        .get('/azure-cli-monitor/json')
        .matchHeader(
          'authorization',
          'Basic b2F1dGgyYWNjZXNzdG9rZW46c29tZS10b2tlbg==',
        )
        .reply(200, Fixtures.get('azure-cli-monitor-updated.json'));
      const config = {
        registryUrls: [
          'https://someregion-python.pkg.dev/some-project/some-repo',
        ],
      };
      googleAuth.mockImplementationOnce(
        vi.fn().mockImplementationOnce(() => ({
          getAccessToken: vi.fn().mockResolvedValue('some-token'),
        })),
      );
      const res = await getPkgReleases({
        ...config,
        datasource,
        packageName: 'azure-cli-monitor',
      });
      expect(res).toMatchObject({ releases: azureCliMonitorReleases });
      expect(googleAuth).toHaveBeenCalledTimes(1);
    });

    it('supports Google Auth not being configured', async () => {
      httpMock
        .scope('https://someregion-python.pkg.dev/some-project/some-repo/')
        .get('/azure-cli-monitor/json')
        .reply(200, Fixtures.get('azure-cli-monitor-updated.json'));
      const config = {
        registryUrls: [
          'https://someregion-python.pkg.dev/some-project/some-repo',
        ],
      };
      googleAuth.mockImplementation(
        vi.fn().mockImplementation(() => ({
          getAccessToken: vi.fn().mockResolvedValue(undefined),
        })),
      );
      const res = await getPkgReleases({
        ...config,
        datasource,
        packageName: 'azure-cli-monitor',
      });
      expect(res).toMatchObject({ releases: azureCliMonitorReleases });
      expect(googleAuth).toHaveBeenCalledTimes(1);
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

      httpMock
        .scope(baseUrl)
        .get('/not-normalized-package/')
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
        .reply(200, Fixtures.get('versions-html-hyphens.html'));
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

    it('process data from simple endpoint with zip archives', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/company-aws-sso-client/')
        .reply(200, Fixtures.get('versions-archives.html'));
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'company-aws-sso-client',
      });
      expect(res?.releases).toMatchObject([
        { version: '0.11.7' },
        { version: '0.11.8' },
      ]);
    });

    it('process data from simple endpoint with hyphens replaced with underscores', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/image-collector/')
        .reply(200, Fixtures.get('versions-html-mixed-hyphens.html'));
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

    it('process data from simple endpoint with periods when using normalized name', async () => {
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
        packageName: 'package-with-periods',
      });
      expect(res?.releases).toMatchObject([
        { version: '2.0.0' },
        { version: '2.0.1' },
        { version: '2.0.2' },
      ]);
    });

    it('process data from simple endpoint for snowflake-legacy', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/snowflake-legacy/')
        .reply(200, Fixtures.get('versions-html-snowflake-legacy.html'));
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'snowflake-legacy',
      });
      expect(res?.releases).toMatchObject([
        { version: '0.3.0' },
        { version: '0.4.0' },
        { version: '0.5.0' },
        { version: '0.7.0' },
        { version: '0.8.0' },
        { version: '0.8.1' },
        { version: '0.9.0' },
        { version: '0.10.0' },
        { version: '0.11.0' },
      ]);
    });

    it('ignores invalid distribution file name formats', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/invalid-version/')
        .reply(200, Fixtures.get('versions-html-invalid-version.html'));
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'invalid-version',
      });
      expect(res?.releases).toMatchObject([]);
    });

    it('process data from simple endpoint with non normalized name', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/friendly-bard/')
        .reply(
          200,
          Fixtures.get('versions-html-with-non-normalized-name.html'),
        );
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'friendly-bard',
      });
      expect(res?.releases).toMatchObject([
        { version: '2.0.0' },
        { version: '2.0.1' },
        { version: '2.0.2' },
        { version: '2.0.3' },
        { version: '2.0.4' },
      ]);
    });

    it('process data from simple endpoint with extra whitespaces in html', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/package-with-whitespaces/')
        .reply(200, Fixtures.get('versions-html-with-whitespaces.html'));
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'package-with-whitespaces',
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
        .reply(200, Fixtures.get('versions-html-badfile.html'));
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

    it.each([404, 403])(
      'fall back from json and process data from simple endpoint',
      async (code: number) => {
        httpMock
          .scope('https://custom.pypi.net/foo')
          .get('/dj-database-url/json')
          .reply(code);
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
        expect(result).not.toBeNull();
      },
    );

    it('parses data-requires-python and respects constraints from simple endpoint', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, Fixtures.get('versions-html-data-requires-python.html'));
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

  it('supports Google Auth with simple endpoint', async () => {
    httpMock
      .scope('https://someregion-python.pkg.dev/some-project/some-repo/simple/')
      .get('/dj-database-url/')
      .reply(200, htmlResponse);
    const config = {
      registryUrls: [
        'https://someregion-python.pkg.dev/some-project/some-repo/simple/',
      ],
    };
    googleAuth.mockImplementationOnce(
      vi.fn().mockImplementationOnce(() => ({
        getAccessToken: vi.fn().mockResolvedValue('some-token'),
      })),
    );
    expect(
      await getPkgReleases({
        datasource,
        ...config,
        constraints: { python: '2.7' },
        packageName: 'dj-database-url',
      }),
    ).toMatchObject({
      isPrivate: true,
      registryUrl:
        'https://someregion-python.pkg.dev/some-project/some-repo/simple',
      releases: djDatabaseUrlSimpleReleases,
    });
    expect(googleAuth).toHaveBeenCalledTimes(1);
  });

  it('ignores an invalid URL when checking for auth headers', async () => {
    const config = {
      registryUrls: ['not-a-url/simple/'],
    };
    const res = await getPkgReleases({
      ...config,
      datasource,
      packageName: 'azure-cli-monitor',
    });
    expect(res).toBeNil();
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
