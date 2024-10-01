import { codeBlock } from 'common-tags';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { regEx } from '../../../util/regex';
import * as mavenVersioning from '../../versioning/maven';
import { MAVEN_REPO } from '../maven/common';
import { extractPageLinks } from '../sbt-package/util';
import { SbtPluginDatasource } from '.';

const mavenIndexHtml = Fixtures.get(`maven-index.html`);
const sbtPluginIndex = Fixtures.get(`sbt-plugins-index.html`);

describe('modules/datasource/sbt-plugin/index', () => {
  it('parses Maven index directory', () => {
    expect(
      extractPageLinks(mavenIndexHtml, (x) =>
        regEx(/^\.+/).test(x) ? null : x,
      ),
    ).toMatchSnapshot();
  });

  it('parses sbt index directory', () => {
    expect(
      extractPageLinks(sbtPluginIndex, (x) =>
        regEx(/^\.+/).test(x) ? null : x,
      ),
    ).toMatchSnapshot();
  });

  it('uses proper hostType', () => {
    const ds = new SbtPluginDatasource();
    expect(ds).toMatchObject({
      id: SbtPluginDatasource.id,
      http: { hostType: 'sbt' },
    });
  });

  describe('getPkgReleases', () => {
    it('returns null in case of errors', async () => {
      httpMock
        .scope('https://failed_repo/maven/')
        .get('/org/scalatest/')
        .reply(404)
        .get('/org/scalatest/scalatest/')
        .reply(404)
        .get('/org.scalatest/')
        .reply(404)
        .get('/org.scalatest/scalatest/')
        .reply(404);

      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/org/scalatest/')
        .reply(404)
        .get('/org/scalatest/scalaz/')
        .reply(404);

      httpMock
        .scope('https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/')
        .get('/org.scalatest/scalaz/')
        .reply(404)
        .get('/org.scalatest/')
        .reply(404)
        .get('/org/scalatest/scalaz/')
        .reply(404)
        .get('/org/scalatest/')
        .reply(404);

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
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/org/foundweekends/sbt-bintray/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="scala_2.12/">scala_2.12/</a></pre>
              </body>
            </html>
          `,
        )
        .get('/org/foundweekends/sbt-bintray/scala_2.12/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="sbt_1.0/">sbt_1.0/</a></pre>
              </body>
            </html>
          `,
        )
        .get('/org/foundweekends/sbt-bintray/scala_2.12/sbt_1.0/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="0.5.5/">0.5.5/</a></pre>
              </body>
            </html>
          `,
        );

      httpMock
        .scope('https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/')
        .get('/org.foundweekends/sbt-bintray/')
        .reply(404)
        .get('/org.foundweekends/')
        .reply(404)
        .get('/org/foundweekends/sbt-bintray/')
        .reply(404)
        .get('/org/foundweekends/')
        .reply(404);

      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.foundweekends:sbt-bintray',
          registryUrls: [],
        }),
      ).toEqual({
        dependencyUrl:
          'https://repo.maven.apache.org/maven2/org/foundweekends/sbt-bintray',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '0.5.5' }],
      });
    });

    it('fetches sbt plugins 2', async () => {
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/org/foundweekends/sbt-bintray/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="scala_2.12/">scala_2.12/</a></pre>
              </body>
            </html>
          `,
        )
        .get('/org/foundweekends/sbt-bintray/scala_2.12/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="sbt_1.0/">sbt_1.0/</a></pre>
              </body>
            </html>
          `,
        )
        .get('/org/foundweekends/sbt-bintray/scala_2.12/sbt_1.0/')
        .reply(
          200,
          codeBlock`
            <html>
              <head> </head>
              <body>
                <pre><a href="../">../</a></pre>
                <pre><a href="0.5.5/">0.5.5/</a></pre>
              </body>
            </html>
          `,
        );

      httpMock
        .scope('https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases/')
        .get('/org.foundweekends/sbt-bintray/')
        .reply(404)
        .get('/org.foundweekends/')
        .reply(404)
        .get('/org/foundweekends/sbt-bintray/')
        .reply(404)
        .get('/org/foundweekends/')
        .reply(404);

      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: SbtPluginDatasource.id,
          packageName: 'org.foundweekends:sbt-bintray_2.12',
          registryUrls: [],
        }),
      ).toEqual({
        dependencyUrl:
          'https://repo.maven.apache.org/maven2/org/foundweekends/sbt-bintray',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '0.5.5' }],
      });
    });

    it('extracts URL from Maven POM file', async () => {
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/io/get-coursier/')
        .reply(
          200,
          codeBlock`
            <a href="../">../</a>
            <a href="sbt-coursier_2.10_0.13/">sbt-coursier_2.10_0.13/</a>
            <a href="sbt-coursier_2.12_1.0/">sbt-coursier_2.12_1.0/</a>
            <a href="sbt-coursier_2.12_1.0.0-M5/"
              >sbt-coursier_2.12_1.0.0-M5/</a
            >
            <a href="sbt-coursier_2.12_1.0.0-M6/"
              >sbt-coursier_2.12_1.0.0-M6/</a
            >
          `,
        )
        .get('/io/get-coursier/sbt-coursier_2.12_1.0/')
        .reply(
          200,
          codeBlock`
            <a href="2.0.0-RC2/">2.0.0-RC2/</a>
            <a href="2.0.0-RC6-1/">2.0.0-RC6-1/</a>
            <a href="2.0.0-RC6-2/">2.0.0-RC6-2/</a>
            <a href="2.0.0-RC6-6/">2.0.0-RC6-6/</a>
          `,
        )
        .get(
          '/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-6/sbt-coursier-2.0.0-RC6-6.pom',
        )
        .reply(
          200,
          codeBlock`
            <project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://maven.apache.org/POM/4.0.0" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
              <url>https://get-coursier.io/</url>
              <scm>
                <url>https://github.com/coursier/sbt-coursier</url>
              </scm>
            </project>
          `,
        )

        .get('/io/get-coursier/sbt-coursier/')
        .reply(404)
        .get('/io/get-coursier/sbt-coursier_2.10_0.13/')
        .reply(404)
        .get('/io/get-coursier/sbt-coursier_2.12_1.0.0-M5/')
        .reply(404)
        .get('/io/get-coursier/sbt-coursier_2.12_1.0.0-M6/')
        .reply(404)
        .get(
          '/io/get-coursier/sbt-coursier_2.10_0.13/2.0.0-RC6-6/sbt-coursier_2.10_0.13-2.0.0-RC6-6.pom',
        )
        .reply(404)
        .get(
          '/io/get-coursier/sbt-coursier_2.10_0.13/2.0.0-RC6-6/sbt-coursier-2.0.0-RC6-6.pom',
        )
        .reply(404)
        .get(
          '/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-6/sbt-coursier_2.12_1.0-2.0.0-RC6-6.pom',
        )
        .reply(404);

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
