import { GoogleAuth as _googleAuth } from 'google-auth-library';
import { ReleaseResult, getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { mocked } from '../../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import * as hostRules from '../../../util/host-rules';
import { id as versioning } from '../../versioning/maven';
import { MavenDatasource } from '.';

const googleAuth = mocked(_googleAuth);
jest.mock('google-auth-library');

const datasource = MavenDatasource.id;

const baseUrl = 'https://repo.maven.apache.org/maven2';
const baseUrlCustom = 'https://custom.registry.renovatebot.com';

const arRegistry = 'maven.pkg.dev/some-project/some-repository';
const baseUrlAR = `artifactregistry://${arRegistry}`;
const baseUrlARHttps = `https://${arRegistry}`;

interface SnapshotOpts {
  version: string;
  jarStatus?: number;
  meta?: string;
}

interface MockOpts {
  dep?: string;
  base?: string;
  meta?: string | null;
  pom?: string | null;
  latest?: string;
  jars?: Record<string, number> | null;
  snapshots?: SnapshotOpts[] | null;
  html?: string | null;
}

function mockGenericPackage(opts: MockOpts = {}) {
  const {
    dep = 'org.example:package',
    base = baseUrl,
    latest = '2.0.0',
    html,
  } = opts;
  const meta =
    opts.meta === undefined ? Fixtures.get('metadata.xml') : opts.meta;
  const pom = opts.pom === undefined ? Fixtures.get('pom.xml') : opts.pom;
  const jars =
    opts.jars === undefined
      ? {
          '0.0.1': 200,
          '1.0.0': 200,
          '1.0.1': 404,
          '1.0.2': 500,
          '2.0.0': 200,
        }
      : opts.jars;

  const snapshots =
    opts.snapshots === undefined
      ? [
          {
            version: '1.0.3-SNAPSHOT',
            meta: Fixtures.get('metadata-snapshot-version.xml'),
            jarStatus: 200,
          },
          {
            version: '1.0.4-SNAPSHOT',
            meta: Fixtures.get('metadata-snapshot-version-invalid.xml'),
          },
          {
            version: '1.0.5-SNAPSHOT',
          },
        ]
      : opts.snapshots;

  const scope = httpMock.scope(base);

  const [group, artifact] = dep.split(':');
  const packagePath = `${group.replace(/\./g, '/')}/${artifact}`;

  if (meta) {
    scope.get(`/${packagePath}/maven-metadata.xml`).reply(200, meta);
  }

  if (html) {
    scope.get(`/${packagePath}/index.html`).reply(200, html);
  } else if (html === null) {
    scope.get(`/${packagePath}/index.html`).reply(404);
  }

  if (pom) {
    if (latest.endsWith('-SNAPSHOT')) {
      const [major, minor, patch] = latest
        .replace('-SNAPSHOT', '')
        .split('.')
        .map((x) => parseInt(x, 10))
        .map((x) => (x < 10 ? `0${x}` : `${x}`));
      scope
        .get(
          `/${packagePath}/${latest}/${artifact}-${latest.replace(
            '-SNAPSHOT',
            '',
          )}-20200101.${major}${minor}${patch}-${parseInt(patch, 10)}.pom`,
        )
        .reply(200, pom);
    } else {
      scope
        .get(`/${packagePath}/${latest}/${artifact}-${latest}.pom`)
        .reply(200, pom);
    }
  }

  if (jars) {
    Object.entries(jars).forEach(([version, status]) => {
      const [major, minor, patch] = version
        .replace('-SNAPSHOT', '')
        .split('.')
        .map((x) => parseInt(x, 10))
        .map((x) => (x < 10 ? `0${x}` : `${x}`));
      const timestamp = `2020-01-01T${major}:${minor}:${patch}.000Z`;
      const headers: httpMock.ReplyHeaders = version.startsWith('0.')
        ? {}
        : { 'Last-Modified': timestamp };
      scope
        .head(`/${packagePath}/${version}/${artifact}-${version}.pom`)
        .reply(status, '', headers);
    });
  }

  if (snapshots) {
    snapshots.forEach((snapshot) => {
      if (snapshot.meta) {
        scope
          .get(`/${packagePath}/${snapshot.version}/maven-metadata.xml`)
          .reply(200, snapshot.meta);
      } else {
        scope
          .get(`/${packagePath}/${snapshot.version}/maven-metadata.xml`)
          .reply(404, '');
      }

      if (snapshot.jarStatus) {
        const [major, minor, patch] = snapshot.version
          .replace('-SNAPSHOT', '')
          .split('.')
          .map((x) => parseInt(x, 10))
          .map((x) => (x < 10 ? `0${x}` : `${x}`));
        const timestamp = `2020-01-01T${major}:${minor}:${patch}.000Z`;
        scope
          .head(
            `/${packagePath}/${
              snapshot.version
            }/${artifact}-${snapshot.version.replace(
              '-SNAPSHOT',
              '',
            )}-20200101.${major}${minor}${patch}-${parseInt(patch, 10)}.pom`,
          )
          .reply(snapshot.jarStatus, '', { 'Last-Modified': timestamp });
      } else {
        scope
          .head(
            `/${packagePath}/${snapshot.version}/${artifact}-${snapshot.version}.pom`,
          )
          .reply(404, '');
      }
    });
  }
}

function get(
  packageName = 'org.example:package',
  ...registryUrls: string[]
): Promise<ReleaseResult | null> {
  const conf = { versioning, datasource, packageName };
  return getPkgReleases(registryUrls ? { ...conf, registryUrls } : conf);
}

describe('modules/datasource/maven/index', () => {
  beforeEach(() => {
    hostRules.add({
      hostType: datasource,
      matchHost: 'custom.registry.renovatebot.com',
      token: '123test',
    });
  });

  afterEach(() => {
    hostRules.clear();
    delete process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK;
  });

  it('returns null when metadata is not found', async () => {
    httpMock
      .scope(baseUrl)
      .get('/org/example/package/index.html')
      .reply(404)
      .get('/org/example/package/maven-metadata.xml')
      .reply(404);

    const res = await get();

    expect(res).toBeNull();
  });

  it('returns releases', async () => {
    mockGenericPackage({ html: null });

    const res = await get();

    expect(res).toMatchSnapshot();
  });

  it('returns releases when only snapshot', async () => {
    const meta = Fixtures.get('metadata-snapshot-version.xml');
    mockGenericPackage({
      meta: Fixtures.get('metadata-snapshot-only.xml'),
      jars: null,
      html: null,
      latest: '1.0.3-SNAPSHOT',
      snapshots: [
        {
          version: '1.0.3-SNAPSHOT',
          meta,
          jarStatus: 200,
        },
      ],
    });
    httpMock
      .scope(baseUrl)
      .get('/org/example/package/1.0.3-SNAPSHOT/maven-metadata.xml')
      .reply(200, meta);

    const res = await get();

    expect(res).toEqual({
      display: 'org.example:package',
      group: 'org.example',
      homepage: 'https://package.example.org/about',
      name: 'package',
      packageScope: 'org.example',
      registryUrl: 'https://repo.maven.apache.org/maven2',
      releases: [
        {
          releaseTimestamp: '2020-01-01T01:00:03.000Z',
          version: '1.0.3-SNAPSHOT',
        },
      ],
    });
  });

  it('returns html-based releases', async () => {
    process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK = 'true';

    mockGenericPackage({
      latest: '2.0.0',
      jars: null,
      html: Fixtures.get('index.html'),
      meta: Fixtures.get('index.xml'),
      snapshots: null,
    });

    const res = await get();

    expect(res).toEqual({
      display: 'org.example:package',
      group: 'org.example',
      homepage: 'https://package.example.org/about',
      name: 'package',
      packageScope: 'org.example',
      registryUrl: 'https://repo.maven.apache.org/maven2',
      releases: [
        { version: '1.0.0', releaseTimestamp: '2021-02-22T14:43:00.000Z' },
        { version: '1.0.1', releaseTimestamp: '2021-04-12T15:51:00.000Z' },
        { version: '1.0.2', releaseTimestamp: '2021-06-16T12:47:00.000Z' },
        { version: '2.0.0', releaseTimestamp: '2021-06-18T16:24:00.000Z' },
      ],
    });
  });

  it('returns releases from custom repository', async () => {
    mockGenericPackage({ base: baseUrlCustom });

    const res = await get('org.example:package', baseUrlCustom);

    expect(res).toMatchSnapshot();
  });

  it('falls back to next registry url', async () => {
    mockGenericPackage({ html: null });
    httpMock
      .scope('https://failed_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(404);
    httpMock
      .scope('https://unauthorized_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(403);
    httpMock
      .scope('https://empty_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(200, 'non-sense');
    httpMock
      .scope('https://unknown_error')
      .get('/org/example/package/maven-metadata.xml')
      .replyWithError('unknown');

    const res = await get(
      'org.example:package',
      'https://failed_repo/',
      'https://unauthorized_repo/',
      'https://empty_repo',
      'https://unknown_error',
      baseUrl,
    );

    expect(res).toMatchSnapshot();
  });

  it('throws EXTERNAL_HOST_ERROR for 50x', async () => {
    httpMock
      .scope(baseUrl)
      .get('/org/example/package/maven-metadata.xml')
      .reply(503);

    await expect(get()).rejects.toThrow(EXTERNAL_HOST_ERROR);
  });

  it('ignores unsupported protocols', async () => {
    const base = baseUrl.replace('https', 'http');
    mockGenericPackage({ base });

    const res = await get(
      'org.example:package',
      'ftp://protocol_error_repo',
      base,
    );

    expect(res?.releases).toMatchSnapshot();
  });

  it('skips registry with invalid metadata structure', async () => {
    mockGenericPackage({ html: null });
    httpMock
      .scope('https://invalid_metadata_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(200, Fixtures.get('metadata-invalid.xml'));

    const res = await get(
      'org.example:package',
      'https://invalid_metadata_repo',
      baseUrl,
    );

    expect(res).toMatchSnapshot();
  });

  it('skips registry with invalid XML', async () => {
    mockGenericPackage({ html: null });
    httpMock
      .scope('https://invalid_metadata_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(200, '###');

    const res = await get(
      'org.example:package',
      'https://invalid_metadata_repo',
      baseUrl,
    );

    expect(res).toMatchSnapshot();
  });

  it('handles optional slash at the end of registry url', async () => {
    mockGenericPackage({ html: null });
    const resA = await get('org.example:package', baseUrl.replace(/\/+$/, ''));
    mockGenericPackage({ html: null });
    const resB = await get('org.example:package', baseUrl.replace(/\/*$/, '/'));
    expect(resA).not.toBeNull();
    expect(resB).not.toBeNull();
    expect(resA?.releases).toEqual(resB?.releases);
  });

  it('returns null for invalid registryUrls', async () => {
    const res = await get(
      'org.example:package',

      '${project.baseUri}../../repository/',
    );
    expect(res).toBeNull();
  });

  it('supports scm.url values prefixed with "scm:"', async () => {
    const pom = Fixtures.get('pom.scm-prefix.xml');
    mockGenericPackage({ pom, html: null });

    const res = await get();

    expect(res?.sourceUrl).toBe('https://github.com/example/test');
  });

  it('removes authentication header after redirect', async () => {
    process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK = 'true';

    const frontendHost = 'frontend_for_private_s3_repository';
    const frontendUrl = `https://${frontendHost}/maven2`;
    const backendUrl = 'https://private_s3_repository/maven2';
    const metadataPath = '/org/example/package/maven-metadata.xml';
    const pomfilePath = '/org/example/package/2.0.0/package-2.0.0.pom';
    const queryStr = '?X-Amz-Algorithm=AWS4-HMAC-SHA256';

    hostRules.add({
      hostType: datasource,
      matchHost: frontendHost,
      username: 'username',
      password: 'password',
      timeout: 20000,
    });

    httpMock
      .scope(frontendUrl)
      .get(metadataPath)
      .basicAuth({ user: 'username', pass: 'password' })
      .reply(302, '', {
        Location: `${backendUrl}${metadataPath}${queryStr}`,
      })
      .get(pomfilePath)
      .basicAuth({ user: 'username', pass: 'password' })
      .reply(302, '', {
        Location: `${backendUrl}${pomfilePath}${queryStr}`,
      });
    httpMock
      .scope(backendUrl, { badheaders: ['authorization'] })
      .get(`${metadataPath}${queryStr}`)
      .reply(200, Fixtures.get('metadata.xml'))
      .get(`${pomfilePath}${queryStr}`)
      .reply(200, Fixtures.get('pom.xml'));

    const res = await get('org.example:package', frontendUrl);

    expect(res).toMatchSnapshot();
  });

  it('supports artifactregistry urls with auth', async () => {
    const metadataPaths = [
      '/org/example/package/maven-metadata.xml',
      '/org/example/package/1.0.3-SNAPSHOT/maven-metadata.xml',
      '/org/example/package/1.0.4-SNAPSHOT/maven-metadata.xml',
      '/org/example/package/1.0.5-SNAPSHOT/maven-metadata.xml',
    ];
    const pomfilePath = '/org/example/package/2.0.0/package-2.0.0.pom';
    hostRules.clear();

    for (const path of metadataPaths) {
      httpMock
        .scope(baseUrlARHttps)
        .get(path)
        .matchHeader(
          'authorization',
          'Basic b2F1dGgyYWNjZXNzdG9rZW46c29tZS10b2tlbg==',
        )
        .reply(200, Fixtures.get('metadata.xml'));
    }

    httpMock
      .scope(baseUrlARHttps)
      .get(pomfilePath)
      .matchHeader(
        'authorization',
        'Basic b2F1dGgyYWNjZXNzdG9rZW46c29tZS10b2tlbg==',
      )
      .reply(200, Fixtures.get('pom.xml'));

    googleAuth.mockImplementation(
      jest.fn().mockImplementation(() => ({
        getAccessToken: jest.fn().mockResolvedValue('some-token'),
      })),
    );

    const res = await get('org.example:package', baseUrlAR);

    expect(res).toEqual({
      display: 'org.example:package',
      group: 'org.example',
      homepage: 'https://package.example.org/about',
      name: 'package',
      packageScope: 'org.example',
      registryUrl:
        'artifactregistry://maven.pkg.dev/some-project/some-repository',
      releases: [
        { version: '0.0.1' },
        { version: '1.0.0' },
        { version: '1.0.1' },
        { version: '1.0.2' },
        { version: '1.0.3-SNAPSHOT' },
        { version: '1.0.4-SNAPSHOT' },
        { version: '1.0.5-SNAPSHOT' },
        { version: '2.0.0' },
      ],
    });
    expect(googleAuth).toHaveBeenCalledTimes(5);
  });

  it('supports artifactregistry urls without auth', async () => {
    const metadataPaths = [
      '/org/example/package/maven-metadata.xml',
      '/org/example/package/1.0.3-SNAPSHOT/maven-metadata.xml',
      '/org/example/package/1.0.4-SNAPSHOT/maven-metadata.xml',
      '/org/example/package/1.0.5-SNAPSHOT/maven-metadata.xml',
    ];
    const pomfilePath = '/org/example/package/2.0.0/package-2.0.0.pom';
    hostRules.clear();

    for (const path of metadataPaths) {
      httpMock
        .scope(baseUrlARHttps)
        .get(path)
        .reply(200, Fixtures.get('metadata.xml'));
    }

    httpMock
      .scope(baseUrlARHttps)
      .get(pomfilePath)
      .reply(200, Fixtures.get('pom.xml'));

    googleAuth.mockImplementation(
      jest.fn().mockImplementation(() => ({
        getAccessToken: jest.fn().mockResolvedValue(undefined),
      })),
    );

    const res = await get('org.example:package', baseUrlAR);

    expect(res).toEqual({
      display: 'org.example:package',
      group: 'org.example',
      homepage: 'https://package.example.org/about',
      name: 'package',
      packageScope: 'org.example',
      registryUrl:
        'artifactregistry://maven.pkg.dev/some-project/some-repository',
      releases: [
        { version: '0.0.1' },
        { version: '1.0.0' },
        { version: '1.0.1' },
        { version: '1.0.2' },
        { version: '1.0.3-SNAPSHOT' },
        { version: '1.0.4-SNAPSHOT' },
        { version: '1.0.5-SNAPSHOT' },
        { version: '2.0.0' },
      ],
    });
    expect(googleAuth).toHaveBeenCalledTimes(5);
  });

  describe('fetching parent info', () => {
    const parentPackage = {
      dep: 'org.example:parent',
      meta: null,
      pom: Fixtures.get('parent-scm-homepage/pom.xml'),
      latest: '1.0.0',
      jars: null,
      snapshots: [],
    };

    it('should get source and homepage from parent', async () => {
      mockGenericPackage({
        meta: Fixtures.get('child-no-info/meta.xml'),
        pom: Fixtures.get('child-no-info/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });
      mockGenericPackage(parentPackage);

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/parent-scm/parent',
        homepage: 'https://parent-home.example.com',
      });
    });

    it('should deal with missing parent fields', async () => {
      mockGenericPackage({
        meta: Fixtures.get('child-empty/meta.xml'),
        pom: Fixtures.get('child-empty/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });

      const res = await get();

      expect(res).toMatchObject({
        display: 'org.example:package',
        group: 'org.example',
        name: 'package',
      });
      expect(res).not.toHaveProperty('homepage');
      expect(res).not.toHaveProperty('sourceUrl');
    });

    it('should deal with circular hierarchy', async () => {
      const parentPom = Fixtures.get('child-parent-cycle/parent.pom.xml');
      const parentPomMock = {
        dep: 'org.example:parent',
        meta: null,
        pom: parentPom,
        latest: '2.0.0',
        jars: null,
        snapshots: [],
      };

      const childMeta = Fixtures.get('child-parent-cycle/child.meta.xml');
      const childPom = Fixtures.get('child-parent-cycle/child.pom.xml');
      const childPomMock = {
        dep: 'org.example:child',
        meta: null,
        pom: childPom,
        latest: '2.0.0',
        jars: null,
        snapshots: [],
      };

      mockGenericPackage({
        ...childPomMock,
        meta: childMeta,
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });
      mockGenericPackage(parentPomMock);
      mockGenericPackage(childPomMock);
      mockGenericPackage(parentPomMock);
      mockGenericPackage(childPomMock);
      mockGenericPackage(parentPomMock);

      const res = await get('org.example:child');

      expect(res).toMatchObject({
        homepage: 'https://parent-home.example.com',
      });
    });

    it('should get source from own pom and homepage from parent', async () => {
      mockGenericPackage({
        meta: Fixtures.get('child-scm/meta.xml'),
        pom: Fixtures.get('child-scm/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });
      mockGenericPackage(parentPackage);

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/child-scm/child',
        homepage: 'https://parent-home.example.com',
      });
    });

    it('should get homepage from own pom and source from parent', async () => {
      mockGenericPackage({
        meta: Fixtures.get('child-url/meta.xml'),
        pom: Fixtures.get('child-url/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });
      mockGenericPackage(parentPackage);

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/parent-scm/parent',
        homepage: 'https://child-home.example.com',
      });
    });

    it('should get homepage and source from own pom', async () => {
      mockGenericPackage({
        meta: Fixtures.get('child-all-info/meta.xml'),
        pom: Fixtures.get('child-all-info/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/child-scm/child',
        homepage: 'https://child-home.example.com',
      });
    });

    it('should be able to detect git@github.com:child-scm as valid sourceUrl', async () => {
      mockGenericPackage({
        meta: Fixtures.get('child-scm-gitatcolon/meta.xml'),
        pom: Fixtures.get('child-scm-gitatcolon/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/child-scm/child',
      });
    });

    it('should be able to detect git@github.com/child-scm as valid sourceUrl', async () => {
      mockGenericPackage({
        meta: Fixtures.get('child-scm-gitatslash/meta.xml'),
        pom: Fixtures.get('child-scm-gitatslash/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/child-scm/child',
      });
    });

    it('should be able to detect git://@github.com/child-scm as valid sourceUrl', async () => {
      mockGenericPackage({
        meta: Fixtures.get('child-scm-gitprotocol/meta.xml'),
        pom: Fixtures.get('child-scm-gitprotocol/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/child-scm/child',
      });
    });
  });
});
