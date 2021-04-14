import fs from 'fs';
import nock from 'nock';
import upath from 'upath';
import { getPkgReleases } from '..';
import { getName } from '../../../test/util';
import * as mavenVersioning from '../../versioning/maven';
import { MAVEN_REPO } from '../maven/common';
import { parseIndexDir } from './util';
import * as sbtPlugin from '.';

const mavenIndexHtml = fs.readFileSync(
  upath.resolve(__dirname, `./__fixtures__/maven-index.html`),
  'utf8'
);

const sbtPluginIndex = fs.readFileSync(
  upath.resolve(__dirname, `./__fixtures__/sbt-plugins-index.html`),
  'utf8'
);

describe(getName(__filename), () => {
  it('parses Maven index directory', () => {
    expect(parseIndexDir(mavenIndexHtml)).toMatchSnapshot();
  });
  it('parses sbt index directory', () => {
    expect(parseIndexDir(sbtPluginIndex)).toMatchSnapshot();
  });

  describe('getPkgReleases', () => {
    beforeEach(() => {
      nock.disableNetConnect();
      nock('https://failed_repo').get('/maven/org/scalatest/').reply(404, null);
      nock('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/')
        .reply(
          200,
          '<a href="scalatest/" title=\'scalatest/\'>scalatest_2.12/</a>\n' +
            '<a href="scalatest_2.12/" title=\'scalatest_2.12/\'>scalatest_2.12/</a>\n' +
            "<a href='scalatest_sjs2.12/'>scalatest_2.12/</a>" +
            "<a href='scalatest_native2.12/'>scalatest_2.12/</a>"
        );
      nock('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/scalatest/')
        .reply(200, "<a href='1.2.0/'>1.2.0/</a>");
      nock('https://repo.maven.apache.org')
        .get('/maven2/org/scalatest/scalatest_2.12/')
        .reply(200, "<a href='1.2.3/'>4.5.6/</a>");

      nock('https://dl.bintray.com')
        .get('/sbt/sbt-plugin-releases/com.github.gseitz/')
        .reply(200, '');
      nock('https://dl.bintray.com')
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
      nock('https://dl.bintray.com')
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
      nock('https://dl.bintray.com')
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

      nock('https://repo.maven.apache.org')
        .get('/maven2/io/get-coursier/')
        .reply(
          200,
          '<a href="sbt-coursier_2.10_0.13/">sbt-coursier_2.10_0.13/</a>\n' +
            '<a href="sbt-coursier_2.12_1.0/">sbt-coursier_2.12_1.0/</a>\n' +
            '<a href="sbt-coursier_2.12_1.0.0-M5/">sbt-coursier_2.12_1.0.0-M5/</a>\n' +
            '<a href="sbt-coursier_2.12_1.0.0-M6/">sbt-coursier_2.12_1.0.0-M6/</a>\n'
        );
      nock('https://repo.maven.apache.org')
        .get('/maven2/io/get-coursier/sbt-coursier_2.12_1.0/')
        .reply(
          200,
          '<a href="2.0.0-RC2/">2.0.0-RC2/</a>\n' +
            '<a href="2.0.0-RC6-1/">2.0.0-RC6-1/</a>\n' +
            '<a href="2.0.0-RC6-2/">2.0.0-RC6-2/</a>\n' +
            '<a href="2.0.0-RC6-6/">2.0.0-RC6-6/</a>\n'
        );
      nock('https://repo.maven.apache.org')
        .get(
          '/maven2/io/get-coursier/sbt-coursier_2.12_1.0/2.0.0-RC6-6/sbt-coursier-2.0.0-RC6-6.pom'
        )
        .reply(
          200,
          '<project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://maven.apache.org/POM/4.0.0" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">\n' +
            '<url>https://get-coursier.io/</url>\n' +
            '<scm>\n' +
            '<url>https://github.com/coursier/sbt-coursier</url>\n' +
            '</scm>\n' +
            '</project>\n'
        );
    });

    afterEach(() => {
      nock.enableNetConnect();
    });

    it('returns null in case of errors', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPlugin.id,
          depName: 'org.scalatest:scalatest',
          registryUrls: ['https://failed_repo/maven'],
        })
      ).toBeNull();
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPlugin.id,
          depName: 'org.scalatest:scalaz',
          registryUrls: [],
        })
      ).toBeNull();
    });
    it('fetches sbt plugins', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPlugin.id,
          depName: 'org.foundweekends:sbt-bintray',
          registryUrls: [],
        })
      ).toEqual({
        dependencyUrl:
          'https://dl.bintray.com/sbt/sbt-plugin-releases/org.foundweekends/sbt-bintray',
        registryUrl: 'https://dl.bintray.com/sbt/sbt-plugin-releases',
        releases: [{ version: '0.5.5' }],
      });
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPlugin.id,
          depName: 'org.foundweekends:sbt-bintray_2.12',
          registryUrls: [],
        })
      ).toEqual({
        dependencyUrl:
          'https://dl.bintray.com/sbt/sbt-plugin-releases/org.foundweekends/sbt-bintray',
        registryUrl: 'https://dl.bintray.com/sbt/sbt-plugin-releases',
        releases: [{ version: '0.5.5' }],
      });
    });

    it('extracts URL from Maven POM file', async () => {
      expect(
        await getPkgReleases({
          versioning: mavenVersioning.id,
          datasource: sbtPlugin.id,
          depName: 'io.get-coursier:sbt-coursier',
          registryUrls: [MAVEN_REPO],
        })
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
