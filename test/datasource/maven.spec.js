const nock = require('nock');
const fs = require('fs');

const datasource = require('../../lib/datasource');
const { initLogger } = require('../../lib/logger');

initLogger();

const MYSQL_VERSIONS = [
  '6.0.5',
  '6.0.6',
  '8.0.7',
  '8.0.8',
  '8.0.9',
  '8.0.11',
  '8.0.12',
];

const MYSQL_MAVEN_METADATA = fs.readFileSync(
  'test/_fixtures/gradle/maven/repo1.maven.org/maven2/mysql/mysql-connector-java/maven-metadata.xml',
  'utf8'
);

const MYSQL_MAVEN_MYSQL_POM = fs.readFileSync(
  'test/_fixtures/gradle/maven/repo1.maven.org/maven2/mysql/mysql-connector-java/8.0.12/mysql-connector-java-8.0.12.pom',
  'utf8'
);

const config = {
  datasource: 'maven',
  versionScheme: 'loose',
};

describe('datasource/maven', () => {
  beforeEach(() => {
    nock('http://central.maven.org')
      .get('/maven2/mysql/mysql-connector-java/maven-metadata.xml')
      .reply(200, MYSQL_MAVEN_METADATA);
    nock('http://central.maven.org')
      .get(
        '/maven2/mysql/mysql-connector-java/8.0.12/mysql-connector-java-8.0.12.pom'
      )
      .reply(200, MYSQL_MAVEN_MYSQL_POM);
    nock('http://failed_repo')
      .get('/mysql/mysql-connector-java/maven-metadata.xml')
      .reply(404, null);
    nock('http://empty_repo')
      .get('/mysql/mysql-connector-java/maven-metadata.xml')
      .reply(200, 'non-sense');
  });

  describe('getPkgReleases', () => {
    it('should return empty if library is not found', async () => {
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'unknown/unknown',
        registryUrls: [
          'file://test/_fixtures/gradle/maven/repo1.maven.org/maven2/',
        ],
      });
      expect(releases).toBeNull();
    });

    it('should simply return all versions of a specific library', async () => {
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'org.hamcrest/hamcrest-core',
        registryUrls: [
          'file://test/_fixtures/gradle/maven/repo1.maven.org/maven2/',
          'file://test/_fixtures/gradle/maven/custom_maven_repo/maven2/',
        ],
      });
      expect(releases.releases).toEqual(
        generateReleases([
          '1.1',
          '1.2',
          '1.2.1',
          '1.3',
          '1.3.RC2',
          '2.1-rc2',
          '2.1-rc3',
        ])
      );
    });

    it('should return versions in all repositories for a specific library', async () => {
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'mysql/mysql-connector-java',
        registryUrls: [
          'file://test/_fixtures/gradle/maven/repo1.maven.org/maven2/',
          'file://test/_fixtures/gradle/maven/custom_maven_repo/maven2/',
        ],
      });
      expect(releases.releases).toEqual(
        generateReleases(['6.0.4', ...MYSQL_VERSIONS])
      );
    });

    it('should return all versions of a specific library for http repositories', async () => {
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'mysql/mysql-connector-java',
        registryUrls: ['http://central.maven.org/maven2/'],
      });
      expect(releases.releases).toEqual(generateReleases(MYSQL_VERSIONS));
    });

    it('should return all versions of a specific library if a repository fails', async () => {
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'mysql/mysql-connector-java',
        registryUrls: [
          'http://central.maven.org/maven2/',
          'http://failed_repo/',
          'http://dns_error_repo',
          'http://empty_repo',
        ],
      });
      expect(releases.releases).toEqual(generateReleases(MYSQL_VERSIONS));
    });

    it('should throw registry-failure if maven-central fails', async () => {
      nock('http://central.maven.org')
        .get('/maven2/org/artifact/maven-metadata.xml')
        .times(4)
        .reply(503);

      expect.assertions(1);
      try {
        await datasource.getPkgReleases({
          ...config,
          lookupName: 'org/artifact',
          registryUrls: ['http://central.maven.org/maven2/'],
        });
      } catch (e) {
        expect(e.message).toEqual('registry-failure');
      }
    });

    it('should return all versions of a specific library if a repository fails because invalid protocol', async () => {
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'mysql/mysql-connector-java',
        registryUrls: [
          'http://central.maven.org/maven2/',
          'http://failed_repo/',
          'ftp://protocol_error_repo',
        ],
      });
      expect(releases.releases).toEqual(generateReleases(MYSQL_VERSIONS));
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
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'mysql/mysql-connector-java',
        registryUrls: [
          'http://central.maven.org/maven2/',
          'http://invalid_metadata_repo/maven2/',
        ],
      });
      expect(releases.releases).toEqual(generateReleases(MYSQL_VERSIONS));
    });

    it('should return all versions of a specific library if a repository fails because a metadata file is not xml', async () => {
      const invalidMavenMetadata = `
        Invalid XML
      `;
      nock('http://invalid_metadata_repo')
        .get('/maven2/mysql/mysql-connector-java/maven-metadata.xml')
        .reply(200, invalidMavenMetadata);
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'mysql/mysql-connector-java',
        registryUrls: [
          'http://central.maven.org/maven2/',
          'http://invalid_metadata_repo/maven2/',
        ],
      });
      expect(releases.releases).toEqual(generateReleases(MYSQL_VERSIONS));
    });

    it('should return all versions of a specific library if a repository does not end with /', async () => {
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'mysql/mysql-connector-java',
        registryUrls: ['http://central.maven.org/maven2'],
      });
      expect(releases).not.toBeNull();
    });

    it('should return null if no repositories defined', async () => {
      const releases = await datasource.getPkgReleases({
        ...config,
        lookupName: 'mysql/mysql-connector-java',
      });
      expect(releases).toBeNull();
    });
  });
});

function generateReleases(versions) {
  return versions.map(v => ({ version: v }));
}
