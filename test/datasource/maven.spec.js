const datasource = require('../../lib/datasource');

describe('datasource/maven', () => {
  describe('getPkgReleases', () => {
    it('should return all versions of a specific library', async () => {
      const releases = await datasource.getPkgReleases(
        'pkg:maven/mysql/mysql-connector-java@6.0.5?repository_url=file://test/_fixtures/gradle/maven/repo1.maven.org/maven2/'
      );
      expect(releases.releases).toEqual([
        { version: '8.0.12' },
        { version: '8.0.11' },
        { version: '8.0.9' },
        { version: '8.0.8' },
        { version: '8.0.7' },
        { version: '6.0.6' },
        { version: '6.0.5' },
        { version: '6.0.4' },
      ]);
    });
  });
});
