import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import * as mavenVersioning from '../../versioning/maven';
import { MAVEN_REPO } from '../maven/common';
import { parseIndexDir } from './util';
import { SbtPackageDatasource } from '.';

describe('modules/datasource/sbt-package/index', () => {
  it('parses Maven index directory', () => {
    expect(parseIndexDir(Fixtures.get(`maven-index.html`))).toMatchSnapshot();
  });

  it('parses sbt index directory', () => {
    expect(
      parseIndexDir(Fixtures.get(`sbt-plugins-index.html`)),
    ).toMatchSnapshot();
  });

  it('uses proper hostType', () => {
    const ds = new SbtPackageDatasource();
    expect(ds).toMatchObject({
      id: SbtPackageDatasource.id,
      http: { hostType: 'sbt' },
    });
  });

  describe('getPkgReleases', () => {
    it('returns null in case of errors', async () => {
      httpMock
        .scope('https://failed_repo')
        .get('/maven/org/scalatest/')
        .reply(404)
        .get('/maven/org.scalatest/')
        .reply(404)
        .get('/maven/org/scalatest/scalatest/maven-metadata.xml')
        .reply(404);

      const res = await getPkgReleases({
        versioning: mavenVersioning.id,
        datasource: SbtPackageDatasource.id,
        packageName: 'org.scalatest:scalatest',
        registryUrls: ['https://failed_repo/maven'],
      });

      expect(res).toBeNull();
    });

    it('returns null if there is no version', async () => {
      httpMock
        .scope('https://repo.maven.apache.org')
        .get('/maven2/com/example/')
        .reply(200, '<a href="empty/">empty_2.12/</a>\n')
        .get('/maven2/com/example/empty/')
        .reply(200, '')
        .get('/maven2/com.example/')
        .reply(404)
        .get('/maven2/com/example/empty/maven-metadata.xml')
        .reply(404)
        .get('/maven2/com/example/empty/index.html')
        .reply(404);

      const res = await getPkgReleases({
        versioning: mavenVersioning.id,
        datasource: SbtPackageDatasource.id,
        packageName: 'com.example:empty',
        registryUrls: [],
      });

      expect(res).toBeNull();
    });

    it('fetches releases from Maven', async () => {
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/org/example/')
        .reply(
          200,
          [
            `<a href="example/" title='example/'>example_2.12/</a>`,
            `<a href="example_2.12/" title='example_2.12/'>example_2.12/</a>`,
            `<a href="example_native/" title='example_native/'>example_native/</a>`,
            `<a href="example_sjs/" title='example_sjs/'>example_sjs/</a>`,
          ].join('\n'),
        )
        .get('/org/example/example/')
        .reply(200, `<a href='1.2.0/'>1.2.0/</a>`)
        .get('/org/example/example_2.12/')
        .reply(200, `<a href='1.2.3/'>1.2.3/</a>`)
        .get('/org/example/example/1.2.3/example-1.2.3.pom')
        .twice()
        .reply(200, ``)
        .get('/org/example/example_2.12/1.2.3/example-1.2.3.pom')
        .reply(200, ``)
        .get('/org/example/example_2.12/1.2.3/example_2.12-1.2.3.pom')
        .reply(200, ``);

      const res = await getPkgReleases({
        versioning: mavenVersioning.id,
        datasource: SbtPackageDatasource.id,
        packageName: 'org.example:example',
        registryUrls: [MAVEN_REPO],
      });

      expect(res).toEqual({
        dependencyUrl: 'https://repo.maven.apache.org/maven2/org/example',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '1.2.0' }, { version: '1.2.3' }],
      });
    });

    it('fetches Maven releases with Scala version', async () => {
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/org/example/')
        .reply(
          200,
          `<a href="example_2.12/" title='example_2.12/'>example_2.12/</a>`,
        )
        .get('/org/example/example_2.12/')
        .reply(200, `<a href='1.2.3/'>1.2.3/</a>`)
        .get('/org/example/example_2.12/1.2.3/example-1.2.3.pom')
        .reply(200, ``)
        .get('/org/example/example_2.12/1.2.3/example_2.12-1.2.3.pom')
        .reply(200, ``);

      const res = await getPkgReleases({
        versioning: mavenVersioning.id,
        datasource: SbtPackageDatasource.id,
        packageName: 'org.example:example_2.12',
        registryUrls: [],
      });

      expect(res).toEqual({
        dependencyUrl: 'https://repo.maven.apache.org/maven2/org/example',
        registryUrl: 'https://repo.maven.apache.org/maven2',
        releases: [{ version: '1.2.3' }],
      });
    });

    it('fetches releases from Confluent', async () => {
      httpMock
        .scope('https://packages.confluent.io/maven/io/confluent')
        .get('/')
        .reply(
          200,
          '<a href="/maven/io/confluent/kafka-avro-serializer/">kafka-avro-serializer/</a>',
        )
        .get('/kafka-avro-serializer/')
        .reply(
          200,
          '<a href="/maven/io/confluent/kafka-avro-serializer/7.0.1/">7.0.1/</a>',
        )
        .get('/kafka-avro-serializer/7.0.1/kafka-avro-serializer-7.0.1.pom')
        .reply(
          200,
          `
          <project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns="http://maven.apache.org/POM/4.0.0"
          xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/maven-v4_0_0.xsd">z
            <artifactId>kafka-avro-serializer</artifactId>
            <packaging>jar</packaging>
            <name>kafka-avro-serializer</name>
          </project>
        `,
        );

      const res = await getPkgReleases({
        versioning: mavenVersioning.id,
        datasource: SbtPackageDatasource.id,
        packageName: 'io.confluent:kafka-avro-serializer',
        registryUrls: ['https://packages.confluent.io/maven'],
      });
      expect(res).toEqual({
        dependencyUrl: 'https://packages.confluent.io/maven/io/confluent',
        registryUrl: 'https://packages.confluent.io/maven',
        releases: [{ version: '7.0.1' }],
      });
    });

    it('extracts URL from Maven POM file', async () => {
      httpMock
        .scope('https://repo.maven.apache.org/maven2/')
        .get('/org/example/')
        .reply(200, `<a href="example/" title='example/'>example_2.12/</a>`)
        .get('/org/example/example/')
        .reply(200, `<a href='1.2.3/'>1.2.3/</a>`)
        .get('/org/example/example/1.2.3/example-1.2.3.pom')
        .reply(
          200,
          `
            <project>
              <url>https://package.example.org/about</url>
              <scm>
                <url>https://example.org/repo.git</url>
              </scm>
            </project>
          `,
        );

      const res = await getPkgReleases({
        versioning: mavenVersioning.id,
        datasource: SbtPackageDatasource.id,
        packageName: 'org.example:example',
        registryUrls: [MAVEN_REPO],
      });

      expect(res).toMatchObject({
        homepage: 'https://package.example.org/about',
        sourceUrl: 'https://example.org/repo',
        releases: [{ version: '1.2.3' }],
      });
    });

    it('falls back to Maven for orgarization root folder non-listable repositories', async () => {
      httpMock
        .scope('https://gitlab.com/api/v4/projects/123/packages/maven/')
        .get('/org/example/')
        .reply(404)
        .get('/org.example/')
        .reply(404)
        .get('/org/example/example_2.13/maven-metadata.xml')
        .reply(
          200,
          `
          <?xml version="1.0" encoding="UTF-8"?>
            <metadata>
              <groupId>org.example</groupId>
              <artifactId>package</artifactId>
              <versioning>
                <latest>1.2.3</latest>
                <release>1.2.3</release>
                <versions>
                  <version>1.2.3</version>
                </versions>
              </versioning>
            </metadata>
          `,
        )
        .head('/org/example/example_2.13/1.2.3/example_2.13-1.2.3.pom')
        .reply(200)
        .get('/org/example/example_2.13/1.2.3/example_2.13-1.2.3.pom')
        .reply(200);

      const res = await getPkgReleases({
        versioning: mavenVersioning.id,
        datasource: SbtPackageDatasource.id,
        packageName: 'org.example:example_2.13',
        registryUrls: [
          'https://gitlab.com/api/v4/projects/123/packages/maven/',
        ],
      });

      expect(res).toMatchObject({});
    });
  });
});
