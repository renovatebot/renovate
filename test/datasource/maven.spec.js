const datasource = require('../../lib/datasource');
const { initLogger } = require('../../lib/logger');
const nock = require('nock');
const fs = require('fs');
initLogger();

describe('datasource/maven', () => {
  afterEach(() => {
    jest.resetAllMocks();
    nock.cleanAll();
  });

  describe('getPkgReleases', () => {
    it('should return empty if library not found', async () => {
      const releases = await datasource.getPkgReleases(
        'pkg:maven/unknown/unknown@1.0.5?repository_url=file://test/_fixtures/gradle/maven/repo1.maven.org/maven2/'
      );
      expect(releases).toBeNull();
    });

    it('should return all versions of a specific library', async () => {
      const releases = await datasource.getPkgReleases(
        'pkg:maven/org.hamcrest/hamcrest-core@1.2?repository_url=file://test/_fixtures/gradle/maven/repo1.maven.org/maven2/,file://test/_fixtures/gradle/maven/custom_maven_repo/maven2/'
      );
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

    it('should return all versions of a specific library in all repositories', async () => {
      const releases = await datasource.getPkgReleases(
        'pkg:maven/mysql/mysql-connector-java@6.0.5?repository_url=file://test/_fixtures/gradle/maven/repo1.maven.org/maven2/,file://test/_fixtures/gradle/maven/custom_maven_repo/maven2/'
      );
      expect(releases.releases).toEqual(
        generateReleases([
          '8.0.12',
          '8.0.11',
          '8.0.9',
          '8.0.8',
          '8.0.7',
          '6.0.6',
          '6.0.5',
          '6.0.4',
        ])
      );
    });

    it('should return all versions of a specific library in all http repositories', async () => {
      const mavenMetadata = fs.readFileSync(
        'test/_fixtures/gradle/maven/repo1.maven.org/maven2/mysql/mysql-connector-java/maven-metadata.xml',
        'utf8'
      );
      nock('http://central.maven.org')
        .get('/maven2/mysql/mysql-connector-java/maven-metadata.xml')
        .reply(200, mavenMetadata);

      const releases = await datasource.getPkgReleases(
        'pkg:maven/mysql/mysql-connector-java@6.0.5?repository_url=http://central.maven.org/maven2/'
      );
      expect(releases.releases).toEqual(
        generateReleases([
          '8.0.12',
          '8.0.11',
          '8.0.9',
          '8.0.8',
          '8.0.7',
          '6.0.6',
          '6.0.5',
        ])
      );
    });

    it('should return all versions of a specific library if a repository fails', async () => {
      const mavenMetadata = fs.readFileSync(
        'test/_fixtures/gradle/maven/repo1.maven.org/maven2/mysql/mysql-connector-java/maven-metadata.xml',
        'utf8'
      );
      nock('http://central.maven.org')
        .get('/maven2/mysql/mysql-connector-java/maven-metadata.xml')
        .reply(200, mavenMetadata);
      nock('http://failed_repo')
        .get('/mysql/mysql-connector-java/maven-metadata.xml')
        .reply(404, mavenMetadata);

      const releases = await datasource.getPkgReleases(
        'pkg:maven/mysql/mysql-connector-java@6.0.5?repository_url=http://central.maven.org/maven2/,http://failed_repo/,http://dns_error_repo'
      );
      expect(releases.releases).toEqual(
        generateReleases([
          '8.0.12',
          '8.0.11',
          '8.0.9',
          '8.0.8',
          '8.0.7',
          '6.0.6',
          '6.0.5',
        ])
      );
    });
  });
});

function generateReleases(versions) {
  return versions.map(v => ({ version: v }));
}
