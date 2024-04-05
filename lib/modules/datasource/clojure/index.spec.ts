import upath from 'upath';
import { ReleaseResult, getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import * as hostRules from '../../../util/host-rules';
import { id as versioning } from '../../versioning/maven';
import { ClojureDatasource } from '.';

const baseUrl = 'https://clojars.org/repo';
const baseUrlCustom = 'https://custom.registry.renovatebot.com';

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
}

function mockGenericPackage(opts: MockOpts = {}) {
  const {
    dep = 'org.example:package',
    base = baseUrl,
    latest = '2.0.0',
  } = opts;
  const meta =
    opts.meta === undefined
      ? Fixtures.get('metadata.xml', upath.join('..', 'maven'))
      : opts.meta;
  const pom =
    opts.pom === undefined
      ? Fixtures.get('pom.xml', upath.join('..', 'maven'))
      : opts.pom;
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
            meta: Fixtures.get(
              'metadata-snapshot-version.xml',
              upath.join('..', 'maven'),
            ),
            jarStatus: 200,
          },
          {
            version: '1.0.4-SNAPSHOT',
            meta: Fixtures.get(
              'metadata-snapshot-version-invalid.xml',
              upath.join('..', 'maven'),
            ),
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

  if (pom) {
    scope
      .get(`/${packagePath}/${latest}/${artifact}-${latest}.pom`)
      .reply(200, pom);
  }

  if (jars) {
    Object.entries(jars).forEach(([version, status]) => {
      const [major, minor, patch] = version
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
  const conf = { versioning, datasource: ClojureDatasource.id, packageName };
  return getPkgReleases(registryUrls ? { ...conf, registryUrls } : conf);
}

describe('modules/datasource/clojure/index', () => {
  beforeEach(() => {
    hostRules.add({
      hostType: ClojureDatasource.id,
      matchHost: 'custom.registry.renovatebot.com',
      token: '123test',
    });
  });

  afterEach(() => {
    hostRules.clear();
    delete process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK;
  });

  it('returns releases from custom repository', async () => {
    mockGenericPackage({ base: baseUrlCustom });

    const res = await get('org.example:package', baseUrlCustom);

    expect(res).toMatchSnapshot();
  });

  it('collects releases from all registry urls', async () => {
    mockGenericPackage();
    mockGenericPackage({
      base: baseUrlCustom,
      meta: Fixtures.get('metadata-extra.xml', upath.join('..', 'maven')),
      latest: '3.0.0',
      jars: { '3.0.0': 200 },
      snapshots: [],
    });

    const { releases } = (await get(
      'org.example:package',
      baseUrl,
      baseUrlCustom,
    ))!;

    expect(releases).toMatchObject([
      { version: '0.0.1' },
      { version: '1.0.0' },
      { version: '1.0.3-SNAPSHOT' },
      { version: '2.0.0' },
      { version: '3.0.0' },
    ]);
  });

  it('falls back to next registry url', async () => {
    mockGenericPackage();
    httpMock
      .scope('https://failed_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(404, '}');
    httpMock
      .scope('https://unauthorized_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(403, '}');
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

  it('ignores unsupported protocols', async () => {
    const base = baseUrl.replace('https', 'http');
    mockGenericPackage({ base });

    const { releases } = (await get(
      'org.example:package',
      'ftp://protocol_error_repo',
      base,
    ))!;

    expect(releases).toMatchSnapshot();
  });

  it('skips registry with invalid metadata structure', async () => {
    mockGenericPackage();
    httpMock
      .scope('https://invalid_metadata_repo')
      .get('/org/example/package/maven-metadata.xml')
      .reply(
        200,
        Fixtures.get('metadata-invalid.xml', upath.join('..', 'maven')),
      );

    const res = await get(
      'org.example:package',
      'https://invalid_metadata_repo',
      baseUrl,
    );

    expect(res).toMatchSnapshot();
  });

  it('skips registry with invalid XML', async () => {
    mockGenericPackage();
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
    mockGenericPackage();
    const resA = await get('org.example:package', baseUrl.replace(/\/+$/, ''));
    mockGenericPackage();
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
    const pom = Fixtures.get('pom.scm-prefix.xml', upath.join('..', 'maven'));
    mockGenericPackage({ pom });

    httpMock
      .scope('https://repo.maven.apache.org')
      .get('/maven2/org/example/package/maven-metadata.xml')
      .reply(200, '###');

    const { sourceUrl } = (await get())!;

    expect(sourceUrl).toBe('https://github.com/example/test');
  });
});
