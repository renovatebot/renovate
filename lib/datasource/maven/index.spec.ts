import fs from 'fs';
import { resolve } from 'path';
import nock from 'nock';
import { Release, getPkgReleases } from '..';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import * as hostRules from '../../util/host-rules';
import * as mavenVersioning from '../../versioning/maven';
import { id as datasource } from '.';

const MYSQL_VERSIONS = ['6.0.5', '6.0.6', '8.0.7', '8.0.8', '8.0.9'];

const MYSQL_MAVEN_METADATA = fs.readFileSync(
  resolve(
    __dirname,
    './__fixtures__/repo1.maven.org/maven2/mysql/mysql-connector-java/maven-metadata.xml'
  ),
  'utf8'
);

const MYSQL_MAVEN_MYSQL_POM = fs.readFileSync(
  resolve(
    __dirname,
    './__fixtures__/repo1.maven.org/maven2/mysql/mysql-connector-java/8.0.12/mysql-connector-java-8.0.12.pom'
  ),
  'utf8'
);

const config = {
  versioning: mavenVersioning.id,
  datasource,
};

describe('datasource/maven', () => {
  beforeEach(() => {
    hostRules.add({
      hostType: datasource,
      hostName: 'frontend_for_private_s3_repository',
      username: 'username',
      password: 'password',
      timeout: 20000,
    });
    jest.resetAllMocks();
    nock.cleanAll();
    nock.disableNetConnect();
    nock('https://repo.maven.apache.org')
      .get('/maven2/mysql/mysql-connector-java/maven-metadata.xml')
      .reply(200, MYSQL_MAVEN_METADATA);
    nock('https://repo.maven.apache.org')
      .get(
        '/maven2/mysql/mysql-connector-java/8.0.12/mysql-connector-java-8.0.12.pom'
      )
      .reply(200, MYSQL_MAVEN_MYSQL_POM);
    nock('http://failed_repo')
      .get('/mysql/mysql-connector-java/maven-metadata.xml')
      .reply(404, null);
    nock('http://unauthorized_repo')
      .get('/mysql/mysql-connector-java/maven-metadata.xml')
      .reply(403, null);
    nock('http://empty_repo')
      .get('/mysql/mysql-connector-java/maven-metadata.xml')
      .reply(200, 'non-sense');
    nock('http://frontend_for_private_s3_repository')
      .get('/maven2/mysql/mysql-connector-java/maven-metadata.xml')
      .basicAuth({ user: 'username', pass: 'password' })
      .reply(302, '', {
        Location:
          'http://private_s3_repository/maven2/mysql/mysql-connector-java/maven-metadata.xml?X-Amz-Algorithm=AWS4-HMAC-SHA256',
      })
      .get(
        '/maven2/mysql/mysql-connector-java/8.0.12/mysql-connector-java-8.0.12.pom'
      )
      .basicAuth({ user: 'username', pass: 'password' })
      .reply(302, '', {
        Location:
          'http://private_s3_repository/maven2/mysql/mysql-connector-java/8.0.12/mysql-connector-java-8.0.12.pom?X-Amz-Algorithm=AWS4-HMAC-SHA256',
      });
    nock('http://private_s3_repository', { badheaders: ['authorization'] })
      .get(
        '/maven2/mysql/mysql-connector-java/maven-metadata.xml?X-Amz-Algorithm=AWS4-HMAC-SHA256'
      )
      .reply(200, MYSQL_MAVEN_METADATA)
      .get(
        '/maven2/mysql/mysql-connector-java/8.0.12/mysql-connector-java-8.0.12.pom?X-Amz-Algorithm=AWS4-HMAC-SHA256'
      )
      .reply(200, MYSQL_MAVEN_MYSQL_POM);
    Object.entries({
      '6.0.5': 200,
      '6.0.6': 200,
      '8.0.7': 200,
      '8.0.8': 200,
      '8.0.9': 200,
      '8.0.11': 404,
      '8.0.12': 500,
    }).forEach(([v, status]) => {
      const path = `/maven2/mysql/mysql-connector-java/${v}/mysql-connector-java-${v}.pom`;
      nock('https://repo.maven.apache.org')
        .head(path)
        .reply(status, '', { 'Last-Modified': `good timestamp for ${v}` });
      nock('http://frontend_for_private_s3_repository')
        .head(path)
        .reply(status, '', { 'Last-Modified': `bad timestamp for ${v}` });
    });
  });

  afterEach(() => {
    nock.enableNetConnect();
  });

  function generateReleases(versions: string[]): Release[] {
    return versions.map((v) => ({ version: v }));
  }

  describe('getReleases', () => {
    it('should return empty if library is not found', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'unknown:unknown',
        registryUrls: [
          's3://somewhere.s3.aws.amazon.com',
          'file://lib/datasource/maven/__fixtures__/repo1.maven.org/maven2/',
        ],
      });
      expect(releases).toBeNull();
    });

    it('should simply return all versions of a specific library', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'org.hamcrest:hamcrest-core',
        registryUrls: [
          'file://lib/datasource/maven/__fixtures__/repo1.maven.org/maven2/',
          'file://lib/datasource/maven/__fixtures__/custom_maven_repo/maven2/',
          's3://somewhere.s3.aws.amazon.com',
        ],
      });
      expect(releases.releases).toEqual(
        generateReleases([
          '1.1',
          '1.2',
          '1.2.1',
          '1.3.RC2',
          '1.3',
          '2.1-rc2',
          '2.1-rc3',
        ])
      );
    });

    it('should return versions in all repositories for a specific library', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
        registryUrls: [
          'file://lib/datasource/maven/__fixtures__/repo1.maven.org/maven2/',
          'file://lib/datasource/maven/__fixtures__/custom_maven_repo/maven2/',
        ],
      });
      expect(releases.releases).toEqual(
        generateReleases(['6.0.4', ...MYSQL_VERSIONS, '8.0.11', '8.0.12'])
      );
    });

    it('should return all versions of a specific library for http repositories', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
        registryUrls: ['https://repo.maven.apache.org/maven2/'],
      });
      expect(releases.releases).toEqual(
        generateReleases(MYSQL_VERSIONS).map(({ version }) => ({
          version,
          releaseTimestamp: `good timestamp for ${version}`,
        }))
      );
    });

    it('should return all versions of a specific library if a repository fails', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
        registryUrls: [
          'https://repo.maven.apache.org/maven2/',
          'http://failed_repo/',
          'http://unauthorized_repo/',
          'http://dns_error_repo',
          'http://empty_repo',
        ],
      });
      expect(releases.releases).toEqual(
        generateReleases(MYSQL_VERSIONS).map(({ version }) => ({
          version,
          releaseTimestamp: `good timestamp for ${version}`,
        }))
      );
    });

    it('should throw external-host-error if default maven repo fails', async () => {
      nock('https://repo.maven.apache.org')
        .get('/maven2/org/artifact/maven-metadata.xml')
        .times(4)
        .reply(503);

      expect.assertions(1);
      await expect(
        getPkgReleases({
          ...config,
          depName: 'org:artifact',
          registryUrls: ['https://repo.maven.apache.org/maven2/'],
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('should return all versions of a specific library if a repository fails because invalid protocol', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
        registryUrls: [
          'https://repo.maven.apache.org/maven2/',
          'http://failed_repo/',
          'ftp://protocol_error_repo',
        ],
      });
      expect(releases.releases).toEqual(
        generateReleases(MYSQL_VERSIONS).map(({ version }) => ({
          version,
          releaseTimestamp: `good timestamp for ${version}`,
        }))
      );
    });

    it('should return all versions of a specific library if a repository fails because invalid metadata file is found in another repository', async () => {
      const invalidMavenMetadata = `
        <?xml version="1.0" encoding="UTF-8"?><metadata>
          <groupId>mysql</groupId>
          <artifactId>mysql-connector-java</artifactId>
          <version>8.0.12</version>
          <versioning>
            <lastUpdated>20130301200000</lastUpdated>
          </versioning>
        </metadata>
      `;
      nock('http://invalid_metadata_repo')
        .get('/maven2/mysql/mysql-connector-java/maven-metadata.xml')
        .reply(200, invalidMavenMetadata);
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
        registryUrls: [
          'https://repo.maven.apache.org/maven2/',
          'http://invalid_metadata_repo/maven2/',
        ],
      });
      expect(releases.releases).toEqual(
        generateReleases(MYSQL_VERSIONS).map(({ version }) => ({
          version,
          releaseTimestamp: `good timestamp for ${version}`,
        }))
      );
    });

    it('should return all versions of a specific library if a repository fails because a metadata file is not xml', async () => {
      const invalidMavenMetadata = `
        Invalid XML
      `;
      nock('http://invalid_metadata_repo')
        .get('/maven2/mysql/mysql-connector-java/maven-metadata.xml')
        .reply(200, invalidMavenMetadata);
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
        registryUrls: [
          'https://repo.maven.apache.org/maven2/',
          'http://invalid_metadata_repo/maven2/',
        ],
      });
      expect(releases.releases).toEqual(
        generateReleases(MYSQL_VERSIONS).map(({ version }) => ({
          version,
          releaseTimestamp: `good timestamp for ${version}`,
        }))
      );
    });

    it('should return all versions of a specific library if a repository does not end with /', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
        registryUrls: ['https://repo.maven.apache.org/maven2'],
      });
      expect(releases).not.toBeNull();
    });

    it('should return null if no repositories defined', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
      });
      expect(releases).not.toBeNull();
    });
    it('should return null for invalid registryUrls', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
        // eslint-disable-next-line no-template-curly-in-string
        registryUrls: ['${project.baseUri}../../repository/'],
      });
      expect(releases).toBeNull();
    });
    it('should support scm.url values prefixed with "scm:"', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'io.realm:realm-gradle-plugin',
        registryUrls: ['file://lib/datasource/maven/__fixtures__/jcenter/'],
      });
      expect(releases.sourceUrl).toEqual('https://github.com/realm/realm-java');
    });

    it('should remove authentication header when redirected with authentication in query string', async () => {
      const releases = await getPkgReleases({
        ...config,
        depName: 'mysql:mysql-connector-java',
        registryUrls: ['http://frontend_for_private_s3_repository/maven2'],
      });
      expect(releases.releases).toEqual(generateReleases(MYSQL_VERSIONS));
    });
  });
});
