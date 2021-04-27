import _fs from 'fs-extra';
import { ReleaseResult, getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadFixture, mocked } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import * as hostRules from '../../util/host-rules';
import { id as versioning } from '../../versioning/maven';
import { id as datasource } from '.';

jest.mock('fs-extra');
const fs = mocked(_fs);

const baseUrl = 'https://repo.maven.apache.org/maven2';
const baseUrlCustom = 'https://custom.registry.renovatebot.com';

interface MockOpts {
  base?: string;
  meta?: string;
  pom?: string;
  heads?: Record<string, number>;
}

function mockGenericPackage(opts: MockOpts = {}) {
  const {
    base = baseUrl,
    meta = loadFixture('metadata.xml'),
    pom = loadFixture('pom.xml'),
    heads = {
      '1.0.0': 200,
      '1.0.1': 404,
      '1.0.2': 500,
      '2.0.0': 200,
    },
  } = opts;

  const scope = httpMock.scope(base);

  scope.get('/org/example/package/maven-metadata.xml').reply(200, meta);

  if (heads) {
    const pairs = Object.entries(heads);
    const latest = pairs
      .filter(([, s]) => s >= 200 && s < 300)
      .map(([v]) => v)
      .sort()
      .pop();
    scope
      .get(`/org/example/package/${latest}/package-${latest}.pom`)
      .reply(200, pom);
    pairs.forEach(([version, status]) => {
      const [major, minor, patch] = version
        .split('.')
        .map((x) => parseInt(x, 10))
        .map((x) => (x < 10 ? `0${x}` : `${x}`));
      const timestamp = `2020-01-01T${major}:${minor}:${patch}.000Z`;
      scope
        .head(`/org/example/package/${version}/package-${version}.pom`)
        .reply(status, '', { 'Last-Modified': timestamp });
    });
  }
}

function get(
  depName: string,
  ...registryUrls: string[]
): Promise<ReleaseResult | null> {
  const conf = { versioning, datasource, depName };
  return getPkgReleases(registryUrls ? { ...conf, registryUrls } : conf);
}

describe(getName(), () => {
  beforeEach(() => {
    hostRules.add({
      hostType: datasource,
      hostName: 'custom.registry.renovatebot.com',
      token: 'abc123',
    });
    jest.resetAllMocks();
    httpMock.setup();
  });

  afterEach(() => {
    hostRules.clear();
    httpMock.reset();
    delete process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK;
  });

  it('returns null when metadata is not found', async () => {
    httpMock
      .scope(baseUrl)
      .get('/org/example/package/maven-metadata.xml')
      .reply(404);

    const res = await get('org.example:package');

    expect(res).toBeNull();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('returns releases', async () => {
    mockGenericPackage();

    const res = await get('org.example:package');

    expect(res).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('returns releases from custom repository', async () => {
    mockGenericPackage({ base: baseUrlCustom });

    const res = await get('org.example:package', baseUrlCustom);

    expect(res).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('collects releases from all registry urls', async () => {
    mockGenericPackage();
    mockGenericPackage({
      base: baseUrlCustom,
      meta: loadFixture('metadata-extra.xml'),
      heads: { '3.0.0': 200 },
    });

    const { releases } = await get(
      'org.example:package',
      baseUrl,
      baseUrlCustom
    );

    expect(releases).toMatchObject([
      { version: '1.0.0' },
      { version: '2.0.0' },
      { version: '3.0.0' },
    ]);
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('falls back to next registry url', async () => {
    mockGenericPackage();
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

    await expect(get('org.example:package')).rejects.toThrow(
      EXTERNAL_HOST_ERROR
    );

    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('ignores unsupported protocols', async () => {
    mockGenericPackage();

    const { releases } = await get(
      'org.example:package',
      'ftp://protocol_error_repo',
      's3://protocol_error_repo',
      baseUrl
    );

    expect(releases).toMatchSnapshot();
    expect(httpMock.getTrace()).toMatchSnapshot();
  });

  it('should return all versions of a specific library if a repository fails because invalid metadata file is found in another repository', async () => {
    mockGenericPackage();
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

  it('should return all versions of a specific library if a repository fails because a metadata file is not xml', async () => {
    mockGenericPackage();
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

  it('should return all versions of a specific library if a repository does not end with /', async () => {
    mockGenericPackage();
    const res = await get('org.example:package', baseUrl.replace(/\/+$/, ''));
    expect(res).not.toBeNull();
  });

  it('should return null for invalid registryUrls', async () => {
    const res = await get(
      'org.example:package',
      // eslint-disable-next-line no-template-curly-in-string
      '${project.baseUri}../../repository/'
    );
    expect(res).toBeNull();
  });

  it('should support scm.url values prefixed with "scm:"', async () => {
    const pom = loadFixture('pom.scm-prefix.xml');
    mockGenericPackage({ pom });

    const { sourceUrl } = await get('org.example:package');

    expect(sourceUrl).toEqual('https://github.com/example/test');
  });

  it('should remove authentication header when redirected with authentication in query string', async () => {
    process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK = 'true';

    const frontendHost = 'frontend_for_private_s3_repository';
    const frontendUrl = `https://${frontendHost}/maven2`;
    const backendUrl = 'https://private_s3_repository/maven2';
    const metadataPath = '/org/example/package/maven-metadata.xml';
    const pomfilePath = '/org/example/package/2.0.0/package-2.0.0.pom';
    const queryStr = '?X-Amz-Algorithm=AWS4-HMAC-SHA256';

    hostRules.add({
      hostType: datasource,
      hostName: frontendHost,
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

  it('supports file protocol', async () => {
    fs.exists.mockResolvedValueOnce(false);

    fs.exists.mockResolvedValueOnce(true);
    fs.readFile.mockResolvedValueOnce(Buffer.from(loadFixture('metadata.xml')));

    fs.exists.mockResolvedValueOnce(true);
    fs.readFile.mockResolvedValueOnce(Buffer.from(loadFixture('pom.xml')));

    const res = await get('org.example:package', 'file:///foo', 'file:///bar');

    expect(res).toMatchSnapshot();
    expect(fs.readFile.mock.calls).toMatchSnapshot();
  });
});
