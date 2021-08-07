import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadFixture } from '../../../test/util';
import * as mavenVersioning from '../../versioning/maven';
import { MAVEN_REPO } from '../maven/common';
import { parseIndexDir } from '../sbt-plugin/util';
import * as sbtPackage from '.';

const mavenIndexHtml = loadFixture(`maven-index.html`);
const sbtPluginIndex = loadFixture(`sbt-plugins-index.html`);

describe(getName(), () => {
  it('parses Maven index directory', () => {
    expect(parseIndexDir(mavenIndexHtml)).toMatchSnapshot();
  });

  it('parses sbt index directory', () => {
    expect(parseIndexDir(sbtPluginIndex)).toMatchSnapshot();
  });

  describe('getPkgReleases', () => {
    beforeEach(() => {
      httpMock
        .scope('https://failed_repo')
        .get('/maven/org/scalatest/')
        .reply(404, null);
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/com/example/')
        .reply(200, '<a href="empty/">empty_2.12/</a>\n');
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/com/example/empty/')
        .reply(200, '');
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/')
        .times(3)
        .reply(
          200,
          '<a href="scalatest/" title=\'scalatest/\'>scalatest_2.12/</a>\n' +
            '<a href="scalatest_2.12/" title=\'scalatest_2.12/\'>scalatest_2.12/</a>\n' +
            "<a href='scalatest_sjs2.12/'>scalatest_2.12/</a>" +
            "<a href='scalatest_native2.12/'>scalatest_2.12/</a>" +
            '<a href="scalatest-app_2.12/">scalatest-app_2.12</a>' +
            '<a href="scalatest-flatspec_2.12/">scalatest-flatspec_2.12</a>' +
            '<a href="scalatest-matchers-core_2.12/">scalatest-matchers-core_2.12</a>'
        );
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/scalatest/')
        .reply(200, "<a href='1.2.0/'>1.2.0/</a>");
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/scalatest_2.12/')
        .reply(200, "<a href='1.2.3/'>4.5.6/</a>");
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/scalatest-app_2.12/')
        .reply(200, "<a href='6.5.4/'>3.2.1/</a>");
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/scalatest-flatspec_2.12/')
        .reply(200, "<a href='6.5.4/'>3.2.1/</a>");
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/scalatest-matchers-core_2.12/')
        .reply(200, "<a href='6.5.4/'>3.2.1/</a>");
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/scalatest/scalatest-app_2.12/6.5.4/scalatest-app_2.12-6.5.4.pom'
        )
        .reply(
          200,
          '<project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://maven.apache.org/POM/4.0.0" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">' +
            '<url>http://www.scalatest.org</url>' +
            '<scm>' +
            '<url>https://github.com/scalatest/scalatest</url>' +
            '</scm>' +
            '</project>'
        );
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/scalatest/scalatest-flatspec_2.12/6.5.4/scalatest-flatspec_2.12-6.5.4.pom'
        )
        .reply(
          200,
          '<project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://maven.apache.org/POM/4.0.0" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">' +
            '<scm>' +
            '<url>scm:git:git:git@github.com/scalatest/scalatest</url>' +
            '</scm>' +
            '</project>'
        );
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/org/scalatest/scalatest-matchers-core_2.12/6.5.4/scalatest-matchers-core_2.12-6.5.4.pom'
        )
        .reply(
          200,
          '<project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://maven.apache.org/POM/4.0.0" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">' +
            '<url>http://www.scalatest.org</url>' +
            '</project>'
        );

      httpMock
        .scope('https://dl.bintray.com')
        .get('/sbt/sbt-plugin-releases/com.github.gseitz/')
        .reply(200, '');
      httpMock
        .scope('https://dl.bintray.com')
        .get('/sbt/sbt-plugin-releases/org.foundweekends/sbt-bintray/')
        .reply(
          200,
          '<html>\n' +
            '<head>\n' +
            '</head>\n' +
            '<body>\n' +
            '<pre><a href="scala_2.12/">scala_2.12/</a></pre>\n' +
            '</body>\n' +
            '</html>'
        );
      httpMock
        .scope('https://dl.bintray.com')
        .get(
          '/sbt/sbt-plugin-releases/org.foundweekends/sbt-bintray/scala_2.12/'
        )
        .reply(
          200,
          '\n' +
            '<html>\n' +
            '<head>\n' +
            '</head>\n' +
            '<body>\n' +
            '<pre><a href="sbt_1.0/">sbt_1.0/</a></pre>\n' +
            '</body>\n' +
            '</html>\n'
        );
      httpMock
        .scope('https://dl.bintray.com')
        .get(
          '/sbt/sbt-plugin-releases/org.foundweekends/sbt-bintray/scala_2.12/sbt_1.0/'
        )
        .reply(
          200,
          '\n' +
            '<html>\n' +
            '<head>\n' +
            '</head>\n' +
            '<body>\n' +
            '<pre><a href="0.5.5/">0.5.5/</a></pre>\n' +
            '</body>\n' +
            '</html>\n'
        );
    });

    // TODO: fix mocks
    afterEach(() => httpMock.clear(false));

    it('returns null in case of errors', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPackage.id,
          depName: 'org.scalatest:scalatest',
          registryUrls: ['https://failed_repo/maven'],
        })
      ).toBeNull();
    });

    it('returns null if there is no version', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPackage.id,
          depName: 'com.example:empty',
          registryUrls: [],
        })
      ).toBeNull();
    });

    it('fetches releases from Maven', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPackage.id,
          depName: 'org.scalatest:scalatest',
          registryUrls: ['https://failed_repo/maven', MAVEN_REPO],
        })
      ).toEqual({
        dependencyUrl: 'https://repo.maven.apache.org/maven2/org/scalatest',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '1.2.0' }, { version: '1.2.3' }],
      });
    });

    it('fetches releases from Maven 2', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPackage.id,
          depName: 'org.scalatest:scalatest_2.12',
          registryUrls: [],
        })
      ).toEqual({
        dependencyUrl: 'https://repo.maven.apache.org/maven2/org/scalatest',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '1.2.3' }],
      });
    });

    it('extracts URL from Maven POM file', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPackage.id,
          depName: 'org.scalatest:scalatest-app_2.12',
          registryUrls: [],
        })
      ).toEqual({
        dependencyUrl: 'https://repo.maven.apache.org/maven2/org/scalatest',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '6.5.4' }],
        homepage: 'http://www.scalatest.org',
        sourceUrl: 'https://github.com/scalatest/scalatest',
      });
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPackage.id,
          depName: 'org.scalatest:scalatest-flatspec_2.12',
          registryUrls: [],
        })
      ).toEqual({
        dependencyUrl: 'https://repo.maven.apache.org/maven2/org/scalatest',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '6.5.4' }],
        sourceUrl: 'https://github.com/scalatest/scalatest',
      });
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPackage.id,
          depName: 'org.scalatest:scalatest-matchers-core_2.12',
          registryUrls: [],
        })
      ).toEqual({
        dependencyUrl: 'https://repo.maven.apache.org/maven2/org/scalatest',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '6.5.4' }],
        homepage: 'http://www.scalatest.org',
      });
    });
  });
});
