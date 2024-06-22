import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import * as mavenVersioning from '../../versioning/maven';
import { MAVEN_REPO } from '../maven/common';
import { parseIndexDir } from '../sbt-package/util';
import { SbtPluginDatasource } from '.';

const mavenIndexHtml = Fixtures.get(`maven-index.html`);
const sbtPluginIndex = Fixtures.get(`sbt-plugins-index.html`);

describe('modules/datasource/sbt-plugin/index', () => {
  it('parses Maven index directory', () => {
    expect(parseIndexDir(mavenIndexHtml)).toMatchSnapshot();
  });

  it('parses sbt index directory', () => {
    expect(parseIndexDir(sbtPluginIndex)).toMatchSnapshot();
  });

  it('uses proper hostType', () => {
    const ds = new SbtPluginDatasource();
    expect(ds).toMatchObject({
      id: SbtPluginDatasource.id,
      http: { hostType: 'sbt' },
    });
  });

  describe('getPkgReleases', () => {
    beforeEach(() => {
      httpMock
        .scope('https://failed_repo')
        .get('/maven/org/scalatest/')
        .reply(404);
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/')
        .reply(
          200,
          '<a href="scalatest/" title=\'scalatest/\'>scalatest_2.12/</a>\n' +
            '<a href="scalatest_2.12/" title=\'scalatest_2.12/\'>scalatest_2.12/</a>\n' +
            "<a href='scalatest_sjs2.12/'>scalatest_2.12/</a>" +
            "<a href='scalatest_native2.12/'>scalatest_2.12/</a>",
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
        .scope('https://repo.scala-sbt.org')
        .get('/scalasbt/sbt-plugin-releases/com.github.gseitz/')
        .reply(200, '');
      httpMock
        .scope('https://repo.scala-sbt.org')
        .get('/scalasbt/sbt-plugin-releases/org.foundweekends/sbt-bintray/')
        .reply(
          200,
          '<html>\n' +
            '<head>\n' +
            '</head>\n' +
            '<body>\n' +
            '<pre><a href="scala_2.12/">scala_2.12/</a></pre>\n' +
            '</body>\n' +
            '</html>',
        );
      httpMock
        .scope('https://repo.scala-sbt.org')
        .get(
          '/scalasbt/sbt-plugin-releases/org.foundweekends/sbt-bintray/scala_2.12/',
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
            '</html>\n',
        );
      httpMock
        .scope('https://repo.scala-sbt.org')
        .get(
          '/scalasbt/sbt-plugin-releases/org.foundweekends/sbt-bintray/scala_2.12/sbt_1.0/',
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
            '</html>\n',
        );

      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/io/get-coursier/')
        .reply(
          200,
          '<a href="sbt-coursier_2.10_0.13/">sbt-coursier_2.10_0.13/</a>\n' +
            '<a href="sbt-coursier_2.12_1.0/">sbt-coursier_2.12_1.0/</a>\n' +
            '<a href="sbt-coursier_2.12_1.0.0-M5/">sbt-coursier_2.12_1.0.0-M5/</a>\n' +
            '<a href="sbt-coursier_2.12_1.0.0-M6/">sbt-coursier_2.12_1.0.0-M6/</a>\n',
        );
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/io/get-coursier/sbt-coursier_2.12_1.0/')
        .reply(
          200,
          '<a href="2.0.0-RC2/">2.0.0-RC2/</a>\n' +
            '<a href="2.0.0-RC6-1/">2.0.0-RC6-1/</a>\n' +
            '<a href="2.0.0-RC6-2/">2.0.0-RC6-2/</a>\n' +
            '<a href="2.0.0-RC6-6/">2.0.0-RC6-6/</a>\n',
        );
      httpMock
        .scope('https://repo.maven.apache.org')
        .get(
          '/maven2/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-6/sbt-coursier-2.0.0-RC6-6.pom',
        )
        .reply(
          200,
          '<project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://maven.apache.org/POM/4.0.0" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\n' +
            '<url>https://get-coursier.io/</url>\n' +
            '<scm>\n' +
            '<url>https://github.com/coursier/sbt-coursier</url>\n' +
            '</scm>\n' +
            '</project>\n',
        );
    });

    // TODO: fix mocks
    afterEach(() => httpMock.clear(false));

    it('returns null in case of errors', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.scalatest:scalatest',
          registryUrls: ['https://failed_repo/maven'],
        }),
      ).toBeNull();
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.scalatest:scalaz',
          registryUrls: [],
        }),
      ).toBeNull();
    });

    it('fetches sbt plugins', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.foundweekends:sbt-bintray',
          registryUrls: [],
        }),
      ).toEqual({
        dependencyUrl:
          'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/org.foundweekends/sbt-bintray',
        registryUrl: 'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases',
        releases: [{ version: '0.5.5' }],
      });
    });

    it('fetches sbt plugins 2', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.foundweekends:sbt-bintray_2.12',
          registryUrls: [],
        }),
      ).toEqual({
        dependencyUrl:
          'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/org.foundweekends/sbt-bintray',
        registryUrl: 'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases',
        releases: [{ version: '0.5.5' }],
      });
    });

    it('extracts URL from Maven POM file', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'io.get-coursier:sbt-coursier',
          registryUrls: [MAVEN_REPO],
        }),
      ).toEqual({
        dependencyUrl:
          'https://repo.maven.apache.org/maven2/io/get-coursier/sbt-coursier',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [
          { version: '2.0.0-RC2' },
          { version: '2.0.0-RC6-1' },
          { version: '2.0.0-RC6-2' },
          { version: '2.0.0-RC6-6' },
        ],
        homepage: 'https://get-coursier.io/',
        sourceUrl: 'https://github.com/coursier/sbt-coursier',
      });
    });
  });
});
