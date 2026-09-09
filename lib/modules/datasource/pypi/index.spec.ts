import { codeBlock } from 'common-tags';
import { GoogleAuth as _googleAuth } from 'google-auth-library';
import { dir as tmpDir } from 'tmp-promise';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { partial } from '~test/util.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { extractPackageFile } from '../../manager/pip_requirements/extract.ts';
import { getPkgReleases } from '../index.ts';
import { PypiDatasource } from './index.ts';

vi.mock('google-auth-library');

const googleAuth = vi.mocked(_googleAuth);

const res1 = Fixtures.get('azure-cli-monitor.json');
const numpyResponse = Fixtures.get('numpy.json');
const numpySimpleResponse = Fixtures.get('numpy-simple.json');
const htmlResponse = Fixtures.get('versions-html.html');
const mixedCaseResponse = Fixtures.get('versions-html-mixed-case.html');
const withPeriodsResponse = Fixtures.get('versions-html-with-periods.html');

const azureCliMonitorReleases = [
  { releaseTimestamp: '2017-04-03T16:55:08.000Z', version: '0.0.1' },
  { releaseTimestamp: '2017-04-17T20:32:30.000Z', version: '0.0.2' },
  { releaseTimestamp: '2017-04-28T21:18:47.000Z', version: '0.0.3' },
  { releaseTimestamp: '2017-05-09T21:36:51.000Z', version: '0.0.4' },
  { releaseTimestamp: '2017-05-30T23:13:49.000Z', version: '0.0.5' },
  { releaseTimestamp: '2017-06-13T22:20:58.000Z', version: '0.0.6' },
  { releaseTimestamp: '2017-06-21T22:12:36.000Z', version: '0.0.7' },
  { releaseTimestamp: '2017-07-07T16:22:24.000Z', version: '0.0.8' },
  { releaseTimestamp: '2017-08-28T20:14:31.000Z', version: '0.0.9' },
  { releaseTimestamp: '2017-09-22T23:47:54.000Z', version: '0.0.10' },
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
  describe('registry caching', () => {
    let cacheDir: Awaited<ReturnType<typeof tmpDir>>;

    beforeEach(async () => {
      memCache.init();
      cacheDir = await tmpDir({ unsafeCleanup: true });
      await packageCache.init({ cacheDir: cacheDir.path });
    });

    afterEach(async () => {
      await packageCache.cleanup({});
      memCache.reset();
      await cacheDir.cleanup();
    });

    it('keeps merged PyPI releases within each requirements file registry set', async () => {
      httpMock
        .scope(PypiDatasource.defaultURL)
        .get('/foo/json')
        .reply(200, { releases: { '1.0.0': [{}] } });
      httpMock
        .scope('https://index-a.example/pypi')
        .get('/foo/json')
        .reply(200, { releases: { '2.0.0': [{}] } });
      httpMock
        .scope('https://index-b.example/pypi')
        .get('/foo/json')
        .reply(200, { releases: { '3.0.0': [{}] } });

      const fileA = extractPackageFile(
        '--extra-index-url https://index-a.example/pypi\nfoo==1.0.0\n',
      )!;
      const fileB = extractPackageFile(
        '--extra-index-url https://index-b.example/pypi\nfoo==1.0.0\n',
      )!;
      const firstConfig = {
        ...fileA,
        datasource: 'pypi',
        packageName: fileA.deps[0].packageName!,
      };
      const first = await getPkgReleases(firstConfig);
      const second = await getPkgReleases({
        ...fileB,
        datasource: 'pypi',
        packageName: fileB.deps[0].packageName!,
      });

      expect(first?.releases.map(({ version }) => version)).toEqual([
        '1.0.0',
        '2.0.0',
      ]);
      expect(second?.releases.map(({ version }) => version)).toEqual([
        '1.0.0',
        '3.0.0',
      ]);
      await expect(getPkgReleases(firstConfig)).resolves.toEqual(first);
    });
  });

  describe('getReleases', () => {
    beforeEach(() => {
      vi.stubEnv('PIP_INDEX_URL', undefined);
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/something/json').reply(404);
      httpMock.scope(baseUrl).get('/something/').reply(404);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'something',
        }),
      ).resolves.toBeNull();
    });

    it('processes real data', async () => {
      httpMock.scope(baseUrl).get('/azure-cli-monitor/json').reply(200, res1);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'azure-cli-monitor',
        }),
      ).resolves.toMatchObject({
        releases: [
          {
            releaseTimestamp: '2017-04-03T16:55:08.000Z',
            version: '0.0.1',
          },
          {
            releaseTimestamp: '2017-04-17T20:32:30.000Z',
            version: '0.0.2',
          },
          {
            releaseTimestamp: '2017-04-28T21:18:47.000Z',
            version: '0.0.3',
          },
          {
            releaseTimestamp: '2017-05-09T21:36:51.000Z',
            version: '0.0.4',
          },
          {
            releaseTimestamp: '2017-05-30T23:13:49.000Z',
            version: '0.0.5',
          },
          {
            releaseTimestamp: '2017-06-13T22:20:58.000Z',
            version: '0.0.6',
          },
          {
            releaseTimestamp: '2017-06-21T22:12:36.000Z',
            version: '0.0.7',
          },
          {
            releaseTimestamp: '2017-07-07T16:22:24.000Z',
            version: '0.0.8',
          },
          {
            releaseTimestamp: '2017-08-28T20:14:31.000Z',
            version: '0.0.9',
          },
          {
            releaseTimestamp: '2017-09-22T23:47:54.000Z',
            version: '0.0.10',
          },
          {
            releaseTimestamp: '2017-10-24T02:14:07.000Z',
            version: '0.0.11',
          },
          {
            releaseTimestamp: '2017-11-14T18:31:57.000Z',
            version: '0.0.12',
          },
          {
            releaseTimestamp: '2017-12-05T18:57:54.000Z',
            version: '0.0.13',
          },
          {
            releaseTimestamp: '2018-01-05T21:26:03.000Z',
            version: '0.0.14',
          },
          {
            releaseTimestamp: '2018-01-17T18:36:39.000Z',
            version: '0.1.0',
          },
          {
            releaseTimestamp: '2018-01-31T18:05:22.000Z',
            version: '0.1.1',
          },
          {
            releaseTimestamp: '2018-02-13T18:17:52.000Z',
            version: '0.1.2',
          },
          {
            releaseTimestamp: '2018-03-13T17:08:20.000Z',
            version: '0.1.3',
          },
          {
            releaseTimestamp: '2018-03-27T17:55:25.000Z',
            version: '0.1.4',
          },
          {
            releaseTimestamp: '2018-04-10T17:25:47.000Z',
            version: '0.1.5',
          },
          {
            isDeprecated: true,
            releaseTimestamp: '2018-05-07T17:59:09.000Z',
            version: '0.1.6',
          },
          {
            releaseTimestamp: '2018-05-22T17:25:23.000Z',
            version: '0.1.7',
          },
        ],
        sourceUrl: 'https://github.com/Azure/azure-cli',
      });
    });

    it('uses the earliest upload_time of the files of a version', async () => {
      // The order of the files is not meaningful, so the timestamp must not
      // depend on it: the wheel is listed first, but uploaded a week later
      const json = codeBlock`
        {
          "info": { "name": "foo" },
          "releases": {
            "1.0.0": [
              {
                "filename": "foo-1.0.0-py3-none-any.whl",
                "upload_time": "2024-01-08T00:00:00"
              },
              {
                "filename": "foo-1.0.0.tar.gz",
                "upload_time": "2024-01-01T00:00:00"
              }
            ]
          }
        }
      `;
      httpMock.scope(baseUrl).get('/foo/json').reply(200, json);

      const res = await getPkgReleases({ datasource, packageName: 'foo' });

      expect(res?.releases).toEqual([
        {
          releaseTimestamp: '2024-01-01T00:00:00.000Z',
          version: '1.0.0',
        },
      ]);
    });

    it('uses the upload_time of the first file of real world data', async () => {
      // `numpy` shows how far off that can be:
      // - `1.5.1` was released in 2010
      // - `1.5.1` gained a wheel in 2014, which PyPI lists first
      // - `1.5.0` lists its sdist first, even though a Windows installer was uploaded earlier
      httpMock.scope(baseUrl).get('/numpy/json').reply(200, numpyResponse);

      const res = await getPkgReleases({ datasource, packageName: 'numpy' });

      expect(res?.releases).toEqual([
        { releaseTimestamp: '2010-08-31T18:15:09.000Z', version: '1.5.0' },
        { releaseTimestamp: '2010-11-18T14:16:58.000Z', version: '1.5.1' },
      ]);
    });

    it('supports custom datasource url', async () => {
      httpMock
        .scope('https://custom.pypi.net/foo')
        .get('/azure-cli-monitor/json')
        .reply(200, res1);
      const config = {
        registryUrls: ['https://custom.pypi.net/foo'],
      };
      await expect(
        getPkgReleases({
          ...config,
          datasource,
          packageName: 'azure-cli-monitor',
        }),
      ).resolves.toMatchObject({
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
      // GoogleAuth is mocked as a class and instantiated with `new`, requires regular function
      // eslint-disable-next-line prefer-arrow-callback
      googleAuth.mockImplementationOnce(function () {
        return partial<InstanceType<typeof _googleAuth>>({
          getAccessToken: vi.fn().mockResolvedValue('some-token'),
        });
      });
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
      // GoogleAuth is mocked as a class and instantiated with `new`, requires regular function
      // eslint-disable-next-line prefer-arrow-callback
      googleAuth.mockImplementation(function () {
        return partial<InstanceType<typeof _googleAuth>>({
          getAccessToken: vi.fn(),
        });
      });
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

    it('finds urls from project_urls when home_page is null', async () => {
      const info = {
        name: 'flexget',
        home_page: null,
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
      expect(result?.homepage).toBeUndefined();
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

    it('does not mistake sponsors in project name as sponsors url', async () => {
      const info = {
        name: 'example',
        home_page: 'https://example.com',
        project_urls: {
          random: 'https://github.com/renovatebot/example-sponsors',
        },
      };
      httpMock
        .scope(baseUrl)
        .get('/example/json')
        .reply(200, { ...JSON.parse(res1), info });
      const result = await getPkgReleases({
        datasource,
        packageName: 'example',
      });
      expect(result?.sourceUrl).toBe(info.project_urls.random);
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
      await expect(
        getPkgReleases({
          datasource,
          constraints: { python: '2.7' },
          packageName: 'doit',
          constraintsFiltering: 'strict',
        }),
      ).resolves.toMatchObject({
        releases: [
          { version: '0.4.0' },
          { version: '0.4.1' },
          { version: '0.30.3' },
          { version: '0.31.0' },
        ],
      });
    });

    it('keeps versions with a file without requires_python under strict constraints filtering', async () => {
      httpMock
        .scope(baseUrl)
        .get('/doit/json')
        .reply(200, {
          info: { name: 'doit' },
          releases: {
            '1.0.0': [{ requires_python: '>=3.9' }, { requires_python: null }],
            '1.1.0': [{ requires_python: '>=3.9' }],
          },
        });

      const res = await getPkgReleases({
        datasource,
        constraints: { python: '3.8.0' },
        constraintsFiltering: 'strict',
        packageName: 'doit',
      });

      // `1.0.0` has a file installable on any Python version, `1.1.0` does not
      expect(res?.releases).toMatchObject([{ version: '1.0.0' }]);
    });

    it('process data from simple endpoint', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, htmlResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      await expect(
        getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'dj-database-url',
        }),
      ).resolves.toMatchObject({
        releases: [
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
          { version: '0.5.0', isDeprecated: true },
        ],
      });
    });

    it('process data from +simple endpoint', async () => {
      httpMock
        .scope('https://some.registry.org/+simple/')
        .get('/dj-database-url/')
        .reply(200, htmlResponse);
      const config = {
        registryUrls: ['https://some.registry.org/+simple/'],
      };
      await expect(
        getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'dj-database-url',
        }),
      ).resolves.toMatchObject({
        registryUrl: 'https://some.registry.org/+simple',
        releases: [
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
          { version: '0.5.0' },
        ],
      });
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
      await expect(
        getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'image-collector',
        }),
      ).resolves.toMatchObject({
        releases: [{ version: '0.0.5' }],
      });
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
      await expect(
        getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'dj-database-url',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for 404 response from simple endpoint', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .replyWithError('error');
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      await expect(
        getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'dj-database-url',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for response with no versions', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, Fixtures.get('versions-html-badfile.html'));
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };
      await expect(
        getPkgReleases({
          datasource,
          ...config,
          constraints: { python: '2.7' },
          packageName: 'dj-database-url',
        }),
      ).resolves.toBeNull();
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
      await expect(
        getPkgReleases({
          datasource,
          constraints: { python: '2.7' },
          ...config,
          packageName: 'dj-database-url',
          constraintsFiltering: 'strict',
        }),
      ).resolves.toMatchObject({
        releases: [
          { version: '0.1.2' },
          { version: '0.1.3' },
          { version: '0.1.4' },
          { version: '0.2.0' },
          { version: '0.2.1' },
          { version: '0.2.2' },
        ],
      });
    });

    it('parses JSON-based Simple API response', async () => {
      const simpleJson = codeBlock`
        {
          "files": [
            {
              "filename": "dj-database-url-0.4.1.tar.gz",
              "requires-python": null,
              "yanked": false,
              "upload-time": "2016-04-18T07:30:00.000Z"
            },
            {
              "filename": "dj-database-url-0.4.2.tar.gz",
              "requires-python": ">=3.6",
              "yanked": false,
              "upload-time": "2016-11-01T15:20:33.000Z"
            },
            {
              "filename": "dj_database_url-0.5.0-py2.py3-none-any.whl",
              "requires-python": null,
              "yanked": "security vulnerability",
              "upload-time": "2018-04-10T11:05:00.000Z"
            },
            {
              "filename": "dj-database-url-0.5.0.tar.gz",
              "requires-python": ">=3.5",
              "yanked": false,
              "upload-time": "2018-04-10T11:05:00.000Z"
            },
            {
              "filename": "dj_database_url-0.5.0-py2.py3-none-any.whl.metadata",
              "requires-python": null,
              "yanked": false,
              "upload-time": "2018-04-10T11:05:00.000Z"
            }
          ]
        }
      `;
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, simpleJson, {
          'content-type': 'application/vnd.pypi.simple.v1+json',
        });
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res?.releases).toMatchObject([
        {
          version: '0.4.1',
          releaseTimestamp: '2016-04-18T07:30:00.000Z',
        },
        {
          version: '0.4.2',
          releaseTimestamp: '2016-11-01T15:20:33.000Z',
        },
        {
          version: '0.5.0',
          releaseTimestamp: '2018-04-10T11:05:00.000Z',
          isDeprecated: true,
        },
      ]);
    });

    it('parses JSON body served with a non-vendor +json content-type', async () => {
      const simpleJson = codeBlock`
        {
          "files": [
            {
              "filename": "dj-database-url-0.4.1.tar.gz",
              "yanked": false,
              "upload-time": "2016-04-18T07:30:00.000Z"
            }
          ]
        }
      `;
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, simpleJson, {
          // Some registries/proxies relabel or don't emit the exact vendor media type, while still returning a JSON body.
          'content-type': 'application/json',
        });
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res?.releases).toMatchObject([
        {
          version: '0.4.1',
          releaseTimestamp: '2016-04-18T07:30:00.000Z',
        },
      ]);
    });

    it('retries without negotiated Accept header when registry responds 406', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(406)
        .get('/dj-database-url/')
        .reply(200, htmlResponse);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res?.releases).toMatchObject(djDatabaseUrlSimpleReleases);
    });

    it('does not retry for a status code which is not `406`', async () => {
      // only `406` means the registry could not serve any of the negotiated types, so anything else is a real failure rather than a rejected `Accept` header
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(415);
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res).toBeNull();
    });

    it('retries without negotiated Accept header when abortOnError is set', async () => {
      hostRules.add({
        matchHost: 'abort-on-error.registry.org',
        abortOnError: true,
      });
      httpMock
        .scope('https://abort-on-error.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(406)
        .get('/dj-database-url/')
        .reply(200, htmlResponse);
      const config = {
        registryUrls: ['https://abort-on-error.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res?.releases).toMatchObject(djDatabaseUrlSimpleReleases);
    });

    it('does not retry for status codes unrelated to content negotiation', async () => {
      hostRules.add({
        matchHost: 'abort-on-error.registry.org',
        abortOnError: true,
      });
      httpMock
        .scope('https://abort-on-error.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(500);
      const config = {
        registryUrls: ['https://abort-on-error.registry.org/simple/'],
      };

      await expect(
        getPkgReleases({
          datasource,
          ...config,
          packageName: 'dj-database-url',
        }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('does not retry when the request fails before it is sent', async () => {
      hostRules.add({ matchHost: 'disabled.registry.org', enabled: false });
      const config = {
        registryUrls: ['https://disabled.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res).toBeNull();
    });

    it('does not retry when the request failed without a response', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .replyWithError('some error');
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res).toBeNull();
    });

    it('returns no releases when JSON-based Simple API schema validation fails', async () => {
      const invalidSchemaJson = JSON.stringify({ name: 'dj-database-url' });
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, invalidSchemaJson, {
          'content-type': 'application/vnd.pypi.simple.v1+json',
        });
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      // The body is JSON, so HTML parsing is not attempted; no releases found
      expect(res).toBeNull();
    });

    it('parses HTML body served with a JSON content-type', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, htmlResponse, {
          // Some registries/proxies mislabel the HTML serialization as JSON
          'content-type': 'application/vnd.pypi.simple.v1+json',
        });
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res?.releases).toMatchObject([
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
        { version: '0.5.0', isDeprecated: true },
      ]);
    });

    it('parses JSON-based Simple API response without upload-time', async () => {
      const jsonBody = {
        meta: { 'api-version': '1.0' },
        name: 'some-package',
        files: [
          {
            filename: 'some-package-1.0.0.tar.gz',
            yanked: false,
          },
        ],
      };
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/some-package/')
        .reply(200, JSON.stringify(jsonBody), {
          'content-type': 'application/vnd.pypi.simple.v1+json',
        });
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'some-package',
      });

      expect(res?.releases).toMatchObject([{ version: '1.0.0' }]);
      expect(res?.releases?.[0].releaseTimestamp).toBeUndefined();
    });

    it('parses JSON body served with an HTML content-type', async () => {
      const simpleJson = codeBlock`
        {
          "files": [
            {
              "filename": "dj-database-url-0.4.1.tar.gz",
              "upload-time": "2016-04-18T07:30:00.000Z"
            }
          ]
        }
      `;
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, simpleJson, {
          // Some registries honor the `Accept` header but mislabel the response
          'content-type': 'text/html',
        });
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res?.releases).toMatchObject([
        {
          version: '0.4.1',
          releaseTimestamp: '2016-04-18T07:30:00.000Z',
        },
      ]);
    });

    it('returns no releases for an invalid JSON body served with an HTML content-type', async () => {
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, JSON.stringify({ name: 'dj-database-url' }), {
          'content-type': 'text/html',
        });
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res).toBeNull();
    });

    it('uses the earliest upload-time of a version', async () => {
      const simpleJson = codeBlock`
        {
          "files": [
            {
              "filename": "dj_database_url-0.4.1-py2.py3-none-any.whl",
              "upload-time": "2016-04-25T07:30:00.000Z"
            },
            {
              "filename": "dj-database-url-0.4.1.tar.gz",
              "upload-time": "2016-04-18T07:30:00.000Z"
            },
            {
              "filename": "dj-database-url-0.4.1.zip"
            }
          ]
        }
      `;
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, simpleJson, {
          'content-type': 'application/vnd.pypi.simple.v1+json',
        });
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        packageName: 'dj-database-url',
      });

      expect(res?.releases).toMatchObject([
        {
          version: '0.4.1',
          releaseTimestamp: '2016-04-18T07:30:00.000Z',
        },
      ]);
    });

    it('uses the earliest upload-time of real world data', async () => {
      // `numpy` shows how far off that can be:
      // - `1.5.1` was released in 2010
      // - `1.5.1` gained a wheel in 2014, which PyPI lists first
      // - `1.5.0` lists its sdist first, even though a Windows installer was uploaded earlier
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/numpy/')
        .reply(200, numpySimpleResponse, {
          'content-type': 'application/vnd.pypi.simple.v1+json',
        });

      const res = await getPkgReleases({
        datasource,
        registryUrls: ['https://some.registry.org/simple/'],
        packageName: 'numpy',
      });

      expect(res?.releases).toEqual([
        { releaseTimestamp: '2010-09-15T14:44:53.723Z', version: '1.5.0' },
        { releaseTimestamp: '2010-11-18T14:16:58.801Z', version: '1.5.1' },
      ]);
    });

    it('uses the earliest upload_time of a version from the JSON API', async () => {
      const jsonBody = {
        info: { name: 'some-package' },
        releases: {
          '1.0.0': [
            { upload_time: '2018-04-25T07:30:00.000Z' },
            { upload_time: '2018-04-18T07:30:00.000Z' },
          ],
        },
      };
      httpMock
        .scope(baseUrl)
        .get('/some-package/json')
        .reply(200, JSON.stringify(jsonBody));

      const res = await getPkgReleases({
        datasource,
        packageName: 'some-package',
      });

      expect(res?.releases).toMatchObject([
        {
          version: '1.0.0',
          releaseTimestamp: '2018-04-18T07:30:00.000Z',
        },
      ]);
    });

    it('keeps versions with a file without requires-python under strict constraints filtering', async () => {
      const simpleJson = codeBlock`
        {
          "files": [
            {
              "filename": "dj_database_url-1.0.0-py3-none-any.whl"
            },
            {
              "filename": "dj-database-url-1.0.0.tar.gz",
              "requires-python": ">=3.9"
            },
            {
              "filename": "dj-database-url-1.1.0.tar.gz",
              "requires-python": ">=3.9"
            }
          ]
        }
      `;
      httpMock
        .scope('https://some.registry.org/simple/')
        .get('/dj-database-url/')
        .reply(200, simpleJson, {
          'content-type': 'application/vnd.pypi.simple.v1+json',
        });
      const config = {
        registryUrls: ['https://some.registry.org/simple/'],
      };

      const res = await getPkgReleases({
        datasource,
        ...config,
        constraints: { python: '3.8.0' },
        constraintsFiltering: 'strict',
        packageName: 'dj-database-url',
      });

      // `1.0.0` has a file installable on any Python version, `1.1.0` does not
      expect(res?.releases).toMatchObject([{ version: '1.0.0' }]);
    });
  });

  it('keeps versions with a file without data-requires-python under strict constraints filtering', async () => {
    // if a release's files has at least one `data-requires-python`, and at least one without, we should use the present value, rather than losing both
    const html = codeBlock`
        <html>
          <body>
            <!-- no data-requires-python -->
            <a href="https://example.com/dj_database_url-1.0.0-py3-none-any.whl">dj_database_url-1.0.0-py3-none-any.whl</a><br/>
            <!-- has data-requires-python -->
            <a href="https://example.com/dj-database-url-1.0.0.tar.gz" data-requires-python="&gt;=3.9">dj-database-url-1.0.0.tar.gz</a><br/>

            <!-- a different release -->
            <a href="https://example.com/dj-database-url-1.1.0.tar.gz" data-requires-python="&gt;=3.9">dj-database-url-1.1.0.tar.gz</a><br/>
          </body>
        </html>
      `;
    httpMock
      .scope('https://some.registry.org/simple/')
      .get('/dj-database-url/')
      .reply(200, html);

    const res = await getPkgReleases({
      datasource,
      registryUrls: ['https://some.registry.org/simple/'],
      constraints: { python: '3.8.0' },
      constraintsFiltering: 'strict',
      packageName: 'dj-database-url',
    });

    expect(res?.releases).toEqual([{ version: '1.0.0' }]);
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
    // GoogleAuth is mocked as a class and instantiated with `new`, requires regular function
    // eslint-disable-next-line prefer-arrow-callback
    googleAuth.mockImplementationOnce(function () {
      return partial<InstanceType<typeof _googleAuth>>({
        getAccessToken: vi.fn().mockResolvedValue('some-token'),
      });
    });
    await expect(
      getPkgReleases({
        datasource,
        ...config,
        constraints: { python: '2.7' },
        packageName: 'dj-database-url',
      }),
    ).resolves.toMatchObject({
      isPrivate: true,
      registryUrl:
        'https://someregion-python.pkg.dev/some-project/some-repo/simple',
      releases: djDatabaseUrlSimpleReleases,
    });
    expect(googleAuth).toHaveBeenCalledTimes(1);
  });

  it('sanitizes GAR userinfo when Google auth is used', async () => {
    httpMock
      .scope('https://someregion-python.pkg.dev/some-project/some-repo/simple/')
      .get('/dj-database-url/')
      .reply(200, htmlResponse);
    const config = {
      registryUrls: [
        'https://oauth2accesstoken@someregion-python.pkg.dev/some-project/some-repo/simple/',
      ],
    };
    // GoogleAuth is mocked as a class and instantiated with `new`, requires regular function
    // eslint-disable-next-line prefer-arrow-callback
    googleAuth.mockImplementationOnce(function () {
      return partial<InstanceType<typeof _googleAuth>>({
        getAccessToken: vi.fn().mockResolvedValue('some-token'),
      });
    });
    await expect(
      getPkgReleases({
        datasource,
        ...config,
        constraints: { python: '2.7' },
        packageName: 'dj-database-url',
      }),
    ).resolves.toMatchObject({
      isPrivate: true,
      registryUrl:
        'https://oauth2accesstoken@someregion-python.pkg.dev/some-project/some-repo/simple',
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
    await expect(
      getPkgReleases({
        datasource,
        ...config,
        constraints: { python: '2.7' },
        packageName: 'azure-cli-monitor',
      }),
    ).resolves.toMatchObject({
      registryUrl: 'https://pypi.org/simple',
      releases: [
        { version: '0.0.1' },
        { version: '0.0.2' },
        { version: '0.0.3' },
        { version: '0.0.4' },
        { version: '0.0.5' },
        { version: '0.0.6' },
        { version: '0.0.7' },
        { version: '0.0.8' },
        { version: '0.0.9' },
        { version: '0.0.10' },
        { version: '0.0.11' },
        { version: '0.0.12' },
        { version: '0.0.13' },
        { version: '0.0.14' },
        { version: '0.1.0' },
        { version: '0.1.1' },
        { version: '0.1.2' },
        { version: '0.1.3' },
        { version: '0.1.4' },
        { version: '0.1.5' },
        { version: '0.1.6' },
        { version: '0.1.7' },
      ],
    });
  });
});
