// eslint-disable-next-line import/order
import s3mock from '../../../../test/s3-mock';
import { ReleaseResult, getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { loadFixture } from '../../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import * as hostRules from '../../../util/host-rules';
import { id as versioning } from '../../versioning/maven';
import { MavenDatasource } from '.';
import {parseUrl} from "../../../util/url";

const datasource = MavenDatasource.id;

const baseUrl = 'https://repo.maven.apache.org/maven2';
const baseUrlCustom = 'https://custom.registry.renovatebot.com';
const baseUrlS3 = 's3://repobucket';

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
  html?: string;
}

function mockResource(
  protocol: string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  mockers: {http?: Function; s3?: Function}
) {
  const {http, s3} = mockers;
  switch (protocol) {
    case 'http:':
    case 'https:':
      if (http) {
        http();
      }
      break;
    case 's3:':
      if (s3) {
        s3();
      }
      break;
    default:
      throw new Error(`Unknown protocol: ${protocol}`)
  }
}

function mockGenericPackage(opts: MockOpts = {}) {
  const {
    dep = 'org.example:package',
    base = baseUrl,
    latest = '2.0.0',
    html,
  } = opts;
  const protocol = parseUrl(base).protocol;
  const meta =
    opts.meta === undefined ? loadFixture('metadata.xml') : opts.meta;
  const pom = opts.pom === undefined ? loadFixture('pom.xml') : opts.pom;
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
            meta: loadFixture('metadata-snapshot-version.xml'),
            jarStatus: 200,
          },
          {
            version: '1.0.4-SNAPSHOT',
            meta: loadFixture('metadata-snapshot-version-invalid.xml'),
          },
          {
            version: '1.0.5-SNAPSHOT',
          },
        ]
      : opts.snapshots;

  const [group, artifact] = dep.split(':');
  const packagePath = `${group.replace(/\./g, '/')}/${artifact}`;

  mockResource(protocol, {
    http: () => httpMock.scope(base).get(`/${packagePath}/maven-metadata.xml`).reply(200, meta),
    s3: () => s3mock.mockObject(`${base}/${packagePath}/maven-metadata.xml`, meta)
  });

  if (html) {
    mockResource(protocol, {
      http: () => httpMock.scope(base).get(`/${packagePath}/index.html`).reply(200, html),
      s3: () => s3mock.mockObject(`${base}/${packagePath}/index.html`, html)
    });
  } else if (html === null) {
    mockResource(protocol, {
      http: () => httpMock.scope(base).get(`/${packagePath}/index.html`).reply(404)
    });
  }

  if (pom) {
    mockResource(protocol, {
      http: () => httpMock.scope(base)
        .get(`/${packagePath}/${latest}/${artifact}-${latest}.pom`)
        .reply(200, pom),
      s3: () => s3mock.mockObject(`${base}/${packagePath}/${latest}/${artifact}-${latest}.pom`, pom)
    });
  }

  if (jars) {
    Object.entries(jars).forEach(([version, status]) => {
      const [major, minor, patch] = version
        .replace('-SNAPSHOT', '')
        .split('.')
        .map((x) => parseInt(x, 10))
        .map((x) => (x < 10 ? `0${x}` : `${x}`));
      const timestamp = `2020-01-01T${major}:${minor}:${patch}.000Z`;
      const headers = version.startsWith('0.')
        ? {}
        : { 'Last-Modified': timestamp };
      mockResource(protocol, {
        http: () => httpMock.scope(base)
          .head(`/${packagePath}/${version}/${artifact}-${version}.pom`)
          .reply(status, '', headers),
        s3: () => s3mock.mockObject(`${base}/${packagePath}/${version}/${artifact}-${version}.pom`, '')
      });
    });
  }

  if (snapshots) {
    snapshots.forEach((snapshot) => {
      if (snapshot.meta) {
        mockResource(protocol, {
          http: () => httpMock.scope(base)
            .get(`/${packagePath}/${snapshot.version}/maven-metadata.xml`)
            .reply(200, snapshot.meta),
          s3: () => s3mock.mockObject(`${base}/${packagePath}/${snapshot.version}/maven-metadata.xml`, snapshot.meta)
        });
      } else {
        mockResource(protocol, {
          http: () => httpMock.scope(base)
            .get(`/${packagePath}/${snapshot.version}/maven-metadata.xml`)
            .reply(404, '')
        });
      }

      if (snapshot.jarStatus) {
        const [major, minor, patch] = snapshot.version
          .replace('-SNAPSHOT', '')
          .split('.')
          .map((x) => parseInt(x, 10))
          .map((x) => (x < 10 ? `0${x}` : `${x}`));
        const timestamp = `2020-01-01T${major}:${minor}:${patch}.000Z`;
        const pomUrl =
          `/${packagePath}/${
            snapshot.version
          }/${artifact}-${snapshot.version.replace(
            '-SNAPSHOT',
            ''
          )}-20200101.${major}${minor}${patch}-${parseInt(patch, 10)}.pom`;
        mockResource(protocol, {
          http: () => httpMock.scope(base)
            .head(pomUrl)
            .reply(snapshot.jarStatus, '', { 'Last-Modified': timestamp }),
          s3: () => s3mock.mockObject(`${base}${pomUrl}`, '')
        });
      } else {
        mockResource(protocol, {
          http: () => httpMock.scope(base)
            .head(
              `/${packagePath}/${snapshot.version}/${artifact}-${snapshot.version}.pom`
            )
            .reply(404, '')
        });
      }
    });
  }
}

function get(
  depName = 'org.example:package',
  ...registryUrls: string[]
): Promise<ReleaseResult | null> {
  const conf = { versioning, datasource, depName };
  return getPkgReleases(registryUrls ? { ...conf, registryUrls } : conf);
}

describe('modules/datasource/maven/index', () => {
  beforeEach(() => {
    hostRules.add({
      hostType: datasource,
      matchHost: 'custom.registry.renovatebot.com',
      token: '123test',
    });
    jest.resetAllMocks();
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
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('returns releases', async () => {
    mockGenericPackage({ html: null });

    const res = await get();

    expect(res).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('returns html-based releases', async () => {
    process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK = 'true';

    mockGenericPackage({
      latest: '2.0.0',
      jars: null,
      html: loadFixture('index.html'),
      meta: loadFixture('index.xml'),
      snapshots: null,
    });

    const res = await get();

    expect(res).toEqual({
      display: 'org.example:package',
      group: 'org.example',
      homepage: 'https://package.example.org/about',
      name: 'package',
      registryUrl: 'https://repo.maven.apache.org/maven2',
      releases: [
        { version: '1.0.0', releaseTimestamp: '2021-02-22T14:43:00.000Z' },
        { version: '1.0.1', releaseTimestamp: '2021-04-12T15:51:00.000Z' },
        { version: '1.0.2', releaseTimestamp: '2021-06-16T12:47:00.000Z' },
        { version: '2.0.0', releaseTimestamp: '2021-06-18T16:24:00.000Z' },
      ],
    });
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('returns releases from custom repository', async () => {
    mockGenericPackage({ base: baseUrlCustom });

    const res = await get('org.example:package', baseUrlCustom);

    expect(res).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('returns releases from S3 repository', async () => {
    console.log("qwe =========");
    mockGenericPackage({ base: baseUrlS3 });

    const res = await get('org.example:package', baseUrlS3);
    console.log("asd =========");

    expect(res).toMatchSnapshot();
  });

  it('collects releases from all registry urls', async () => {
    mockGenericPackage({ html: null });
    mockGenericPackage({
      base: baseUrlCustom,
      meta: loadFixture('metadata-extra.xml'),
      latest: '3.0.0',
      jars: { '3.0.0': 200 },
      snapshots: [],
    });

    const { releases } = await get(
      'org.example:package',
      baseUrl,
      baseUrlCustom
    );

    expect(releases).toMatchObject([
      { version: '0.0.1' },
      { version: '1.0.0' },
      { version: '1.0.3-SNAPSHOT' },
      { version: '2.0.0' },
      { version: '3.0.0' },
    ]);
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('falls back to next registry url', async () => {
    mockGenericPackage({ html: null });
    httpMock
      .scope('https://failed_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(404, null);
    httpMock
      .scope('https://unauthorized_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(403, null);
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
      baseUrl
    );

    expect(res).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('throws EXTERNAL_HOST_ERROR for 50x', async () => {
    httpMock
      .scope(baseUrl)
      .get('/org/example/package/maven-metadata.xml')
      .reply(503);

    await expect(get()).rejects.toThrow(EXTERNAL_HOST_ERROR);

    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('ignores unsupported protocols', async () => {
    const base = baseUrl.replace('https', 'http');
    mockGenericPackage({ base });

    const { releases } = await get(
      'org.example:package',
      'ftp://protocol_error_repo',
      's3://protocol_error_repo',
      base
    );

    expect(releases).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('skips registry with invalid metadata structure', async () => {
    mockGenericPackage({ html: null });
    httpMock
      .scope('https://invalid_metadata_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(200, loadFixture('metadata-invalid.xml'));

    const res = await get(
      'org.example:package',
      'https://invalid_metadata_repo',
      baseUrl
    );

    expect(res).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
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
      baseUrl
    );

    expect(res).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('handles optional slash at the end of registry url', async () => {
    mockGenericPackage({ html: null });
    const resA = await get('org.example:package', baseUrl.replace(/\/+$/, ''));
    mockGenericPackage({ html: null });
    const resB = await get('org.example:package', baseUrl.replace(/\/*$/, '/'));
    expect(resA).not.toBeNull();
    expect(resB).not.toBeNull();
    expect(resA.releases).toEqual(resB.releases);
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('returns null for invalid registryUrls', async () => {
    const res = await get(
      'org.example:package',

      '${project.baseUri}../../repository/'
    );
    expect(res).toBeNull();
  });

  it('supports scm.url values prefixed with "scm:"', async () => {
    const pom = loadFixture('pom.scm-prefix.xml');
    mockGenericPackage({ pom, html: null });

    const { sourceUrl } = await get();

    expect(sourceUrl).toBe('https://github.com/example/test');
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
      .reply(200, loadFixture('metadata.xml'))
      .get(`${pomfilePath}${queryStr}`)
      .reply(200, loadFixture('pom.xml'));

    const res = await get('org.example:package', frontendUrl);

    expect(res).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  describe('fetching parent info', () => {
    const parentPackage = {
      dep: 'org.example:parent',
      meta: null,
      pom: loadFixture('parent-scm-homepage/pom.xml'),
      latest: '1.0.0',
      jars: null,
      snapshots: [],
    };

    it('should get source and homepage from parent', async () => {
      mockGenericPackage({
        meta: loadFixture('child-no-info/meta.xml'),
        pom: loadFixture('child-no-info/pom.xml'),
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should deal with missing parent fields', async () => {
      mockGenericPackage({
        meta: loadFixture('child-empty/meta.xml'),
        pom: loadFixture('child-empty/pom.xml'),
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should deal with circular hierarchy', async () => {
      const parentPom = loadFixture('child-parent-cycle/parent.pom.xml');
      const parentPomMock = {
        dep: 'org.example:parent',
        meta: null,
        pom: parentPom,
        latest: '2.0.0',
        jars: null,
        snapshots: [],
      };

      const childMeta = loadFixture('child-parent-cycle/child.meta.xml');
      const childPom = loadFixture('child-parent-cycle/child.pom.xml');
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should get source from own pom and homepage from parent', async () => {
      mockGenericPackage({
        meta: loadFixture('child-scm/meta.xml'),
        pom: loadFixture('child-scm/pom.xml'),
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should get homepage from own pom and source from parent', async () => {
      mockGenericPackage({
        meta: loadFixture('child-url/meta.xml'),
        pom: loadFixture('child-url/pom.xml'),
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should get homepage and source from own pom', async () => {
      mockGenericPackage({
        meta: loadFixture('child-all-info/meta.xml'),
        pom: loadFixture('child-all-info/pom.xml'),
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
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should be able to detect git@github.com:child-scm as valid sourceUrl', async () => {
      mockGenericPackage({
        meta: loadFixture('child-scm-gitatcolon/meta.xml'),
        pom: loadFixture('child-scm-gitatcolon/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/child-scm/child',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('should be able to detect git@github.com/child-scm as valid sourceUrl', async () => {
      mockGenericPackage({
        meta: loadFixture('child-scm-gitatslash/meta.xml'),
        pom: loadFixture('child-scm-gitatslash/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/child-scm/child',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('should be able to detect git://@github.com/child-scm as valid sourceUrl', async () => {
      mockGenericPackage({
        meta: loadFixture('child-scm-gitprotocol/meta.xml'),
        pom: loadFixture('child-scm-gitprotocol/pom.xml'),
        latest: '2.0.0',
        jars: { '2.0.0': 200 },
        snapshots: [],
        html: null,
      });

      const res = await get();

      expect(res).toMatchObject({
        sourceUrl: 'https://github.com/child-scm/child',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
