import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { ExtractConfig, PackageFile } from '../types';
import { extractFile } from './extract';
import { extractAllPackageFiles } from '.';

const fixturesDir = 'lib/modules/manager/sbt/__fixtures__';

const sbt = Fixtures.get(`sample.sbt`);
const sbtScalaVersionVariable = Fixtures.get(`scala-version-variable.sbt`);
const sbtMissingScalaVersion = Fixtures.get(`missing-scala-version.sbt`);
const sbtDependencyFile = Fixtures.get(`dependency-file.scala`);
const sbtPrivateVariableDependencyFile = Fixtures.get(
  `private-variable-dependency-file.scala`
);

describe('modules/manager/sbt/extract', () => {
  describe('extractFile()', () => {
    it('returns null for empty', () => {
      expect(extractFile('')).toBeNull();
      expect(extractFile('non-sense')).toBeNull();
      expect(
        extractFile('libraryDependencies += "foo" % "bar" % ???')
      ).toBeNull();
      expect(
        extractFile('libraryDependencies += "foo" % "bar" %% "baz"')
      ).toBeNull();
      expect(
        extractFile('libraryDependencies += ??? % "bar" % "baz"')
      ).toBeNull();
      expect(
        extractFile('libraryDependencies += "foo" % ??? % "baz"')
      ).toBeNull();

      expect(extractFile('libraryDependencies += ')).toBeNull();
      expect(extractFile('libraryDependencies += "foo"')).toBeNull();
      expect(extractFile('libraryDependencies += "foo" % "bar" %')).toBeNull();
      expect(
        extractFile('libraryDependencies += "foo" % "bar" % "baz" %%')
      ).toBeNull();
    });

    it('extracts deps for generic use-cases', () => {
      expect(extractFile(sbt)).toMatchSnapshot({
        deps: [
          {
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.9.10',
          },
          { packageName: 'org.example:foo', currentValue: '0.0.1' },
          { packageName: 'org.example:bar_2.9.10', currentValue: '0.0.2' },
          { packageName: 'org.example:baz_2.9.10', currentValue: '0.0.3' },
          { packageName: 'org.example:qux', currentValue: '0.0.4' },
          {
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.13.3',
          },
          { packageName: 'org.example:quux', currentValue: '0.0.5' },
          { packageName: 'org.example:quuz_2.9.10', currentValue: '0.0.6' },
          { packageName: 'org.example:corge', currentValue: '0.0.7' },
          { packageName: 'org.example:grault', currentValue: '0.0.8' },
          { packageName: 'org.example:waldo', currentValue: '0.0.9' },
          { packageName: 'org.example:fred', currentValue: '(,8.4.0]' },
        ],
        packageFileVersion: '1.0',
      });
    });

    it('extracts addCompilerPlugin', () => {
      expect(
        extractFile(
          `addCompilerPlugin(("org.spire-math" % "kind-projector" % "0.9.9").cross(CrossVersion.binary))`
        )
      ).toMatchSnapshot({
        deps: [
          {
            packageName: 'org.spire-math:kind-projector',
            currentValue: '0.9.9',
          },
        ],
      });
      expect(
        extractFile(
          `addCompilerPlugin(("org.scalamacros" % "paradise" % "2.1.1").cross(CrossVersion.full))`
        )
      ).toMatchSnapshot({
        deps: [
          {
            packageName: 'org.scalamacros:paradise',
            currentValue: '2.1.1',
          },
        ],
      });
    });

    it('extracts deps when scala version is defined in a variable', () => {
      expect(extractFile(sbtScalaVersionVariable)).toMatchSnapshot({
        deps: [
          { packageName: 'org.example:foo', currentValue: '0.0.1' },
          { packageName: 'org.example:bar_2.12', currentValue: '0.0.2' },
          { packageName: 'org.example:baz_2.12', currentValue: '0.0.3' },
          { packageName: 'org.example:qux', currentValue: '0.0.4' },
          { packageName: 'org.example:quux', currentValue: '0.0.5' },
          { packageName: 'org.example:quuz_2.12', currentValue: '0.0.6' },
          { packageName: 'org.example:corge', currentValue: '0.0.7' },
          { packageName: 'org.example:grault', currentValue: '0.0.8' },
          { packageName: 'org.example:waldo', currentValue: '0.0.9' },
        ],

        packageFileVersion: '3.2.1',
      });
    });

    it('skips deps when scala version is missing', () => {
      expect(extractFile(sbtMissingScalaVersion)).toEqual({
        deps: [
          {
            currentValue: '3.0.0',
            datasource: 'sbt-package',
            depName: 'org.scalatest:scalatest',
            fileReplacePosition: 3,
            packageName: 'org.scalatest:scalatest',
            registryUrls: ['https://repo.maven.apache.org/maven2'],
          },
          {
            currentValue: '1.0.11',
            datasource: 'sbt-plugin',
            depName: 'com.github.gseitz:sbt-release',
            depType: 'plugin',
            editFile: undefined,
            fileReplacePosition: 6,
            groupName: 'sbtReleaseVersion',
            packageName: 'com.github.gseitz:sbt-release',
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://dl.bintray.com/sbt/sbt-plugin-releases',
            ],
          },
        ],
        packageFileVersion: '1.0.1',
        scalaVersion: null,
      });
    });

    it('extract deps from native scala file with variables', () => {
      expect(extractFile(sbtDependencyFile)).toMatchSnapshot({
        deps: [
          {
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.13.0-RC5',
          },
          {
            packageName: 'com.example:foo_2.13.0-RC5',
            currentValue: '0.7.1',
          },
          { packageName: 'com.abc:abc', currentValue: '1.2.3' },
          { packageName: 'com.abc:abc-a', currentValue: '1.2.3' },
          { packageName: 'com.abc:abc-b', currentValue: '1.2.3' },
          { packageName: 'com.abc:abc-c', currentValue: '1.2.3' },
        ],
      });
    });

    it('extracts deps when scala version is defined with a trailing comma', () => {
      const content = `
        lazy val commonSettings = Seq(
          scalaVersion := "2.12.10",
        )
        libraryDependencies += "org.example" %% "bar" % "0.0.2"
      `;
      expect(extractFile(content)).toMatchSnapshot({
        deps: [
          {
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.12.10',
          },
          {
            packageName: 'org.example:bar_2.12',
            currentValue: '0.0.2',
          },
        ],
      });
    });

    it('extracts deps when scala version is defined in a variable with a trailing comma', () => {
      const content = `
        val ScalaVersion = "2.12.10"
        lazy val commonSettings = Seq(
          scalaVersion := ScalaVersion,
        )
        libraryDependencies += "org.example" %% "bar" % "0.0.2"
      `;
      expect(extractFile(content)).toMatchSnapshot({
        deps: [{ packageName: 'org.example:bar_2.12', currentValue: '0.0.2' }],
      });
    });

    it('extracts deps when scala version is defined with ThisBuild scope', () => {
      const content = `
        ThisBuild / scalaVersion := "2.12.10"
        libraryDependencies += "org.example" %% "bar" % "0.0.2"
      `;
      expect(extractFile(content)).toMatchSnapshot({
        deps: [
          {
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.12.10',
          },
          {
            packageName: 'org.example:bar_2.12',
            currentValue: '0.0.2',
          },
        ],
      });
    });

    it('extracts deps when scala version is defined in a variable with ThisBuild scope', () => {
      const content = `
        val ScalaVersion = "2.12.10"
        ThisBuild / scalaVersion := ScalaVersion
        libraryDependencies += "org.example" %% "bar" % "0.0.2"
      `;
      expect(extractFile(content)).toMatchSnapshot({
        deps: [
          {
            packageName: 'org.example:bar_2.12',
            currentValue: '0.0.2',
          },
        ],
      });
    });

    it('extract deps from native scala file with private variables', () => {
      expect(extractFile(sbtPrivateVariableDependencyFile)).toMatchSnapshot({
        deps: [
          {
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.13.0-RC5',
          },
          {
            packageName: 'com.example:foo_2.13.0-RC5',
            currentValue: '0.7.1',
          },
          {
            packageName: 'com.abc:abc',
            currentValue: '1.2.3',
          },
        ],
        packageFileVersion: undefined,
      });
    });

    it('extract deps when they are defined in a new line', () => {
      const content = `
      name := "service"
      scalaVersion := "2.13.8"

      lazy val compileDependencies =
        Seq(
          "com.typesafe.scala-logging" %% "scala-logging" % "3.9.4",
          "ch.qos.logback" % "logback-classic" % "1.2.10"
        )

      libraryDependencies ++= compileDependencies`;
      expect(extractFile(content)).toMatchObject({
        deps: [
          {
            registryUrls: ['https://repo.maven.apache.org/maven2'],
            datasource: 'maven',
            depName: 'scala',
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.13.8',
            separateMinorPatch: true,
          },
          {
            registryUrls: ['https://repo.maven.apache.org/maven2'],
            depName: 'com.typesafe.scala-logging:scala-logging',
            packageName: 'com.typesafe.scala-logging:scala-logging_2.13',
            currentValue: '3.9.4',
            datasource: 'sbt-package',
          },
          {
            registryUrls: ['https://repo.maven.apache.org/maven2'],
            depName: 'ch.qos.logback:logback-classic',
            packageName: 'ch.qos.logback:logback-classic',
            currentValue: '1.2.10',
            datasource: 'sbt-package',
          },
        ],
        packageFileVersion: undefined,
      });
    });
  });

  describe('extractAllPackageFiles()', () => {
    const adminConfig: RepoGlobalConfig = {
      localDir: '',
    };

    const config: ExtractConfig = {};

    beforeEach(() => {
      GlobalConfig.set(adminConfig);
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('extract simple-project with Versions.scala variable file', async () => {
      const registryUrls = ['https://repo.maven.apache.org/maven2'];
      expect(
        await extractAllPackageFiles(config, [
          `${fixturesDir}/simple-project/build.sbt`,
          `${fixturesDir}/simple-project/project/plugins.sbt`,
          `${fixturesDir}/simple-project/project/Versions.scala`,
          `${fixturesDir}/simple-project/submodule/build.sbt`,
        ])
      ).toEqual([
        {
          deps: [
            {
              currentValue: '2.13.8',
              datasource: 'maven',
              depName: 'scala',
              packageName: 'org.scala-lang:scala-library',
              registryUrls,
              separateMinorPatch: true,
            },
            {
              currentValue: '1.2.11',
              datasource: 'sbt-package',
              depName: 'ch.qos.logback:logback-classic',
              fileReplacePosition: 35,
              packageName: 'ch.qos.logback:logback-classic',
              registryUrls,
            },
          ],
          packageFile:
            'lib/modules/manager/sbt/__fixtures__/simple-project/build.sbt',
        },
        {
          deps: [
            {
              currentValue: '0.13.0',
              datasource: 'sbt-package',
              depName: 'io.circe:circe-generic',
              editFile: `${fixturesDir}/simple-project/project/Versions.scala`,
              fileReplacePosition: 7,
              groupName: 'circe',
              packageName: 'io.circe:circe-generic_2.13',
              registryUrls,
            },
            {
              currentValue: '10.2.6',
              datasource: 'sbt-package',
              depName: 'com.typesafe.akka:akka-http',
              editFile: `${fixturesDir}/simple-project/project/Versions.scala`,
              fileReplacePosition: 3,
              groupName: 'akkaHttp',
              packageName: 'com.typesafe.akka:akka-http_2.13',
              registryUrls,
            },
            {
              currentValue: '2.6.18',
              datasource: 'sbt-package',
              depName: 'com.typesafe.akka:akka-stream',
              editFile: `${fixturesDir}/simple-project/project/Versions.scala`,
              fileReplacePosition: 2,
              groupName: 'akka',
              packageName: 'com.typesafe.akka:akka-stream_2.13',
              registryUrls,
            },
            {
              currentValue: '1.3.1',
              datasource: 'sbt-package',
              depName: 'org.sangria-graphql:sangria-circe',
              editFile: `${fixturesDir}/simple-project/project/Versions.scala`,
              fileReplacePosition: 6,
              groupName: 'sangriacirce',
              packageName: 'org.sangria-graphql:sangria-circe_2.13',
              registryUrls,
            },
            {
              currentValue: '3.2.11',
              datasource: 'sbt-package',
              depName: 'org.scalatest:scalatest-wordspec',
              depType: 'Test',
              editFile: `${fixturesDir}/simple-project/project/Versions.scala`,
              fileReplacePosition: 13,
              groupName: 'scalaTest',
              packageName: 'org.scalatest:scalatest-wordspec_2.13',
              registryUrls,
            },
            {
              currentValue: '3.2.11',
              datasource: 'sbt-package',
              depName: 'org.scalatest:scalatest-funsuite',
              depType: 'Test',
              editFile: `${fixturesDir}/simple-project/project/Versions.scala`,
              fileReplacePosition: 13,
              groupName: 'scalaTest',
              packageName: 'org.scalatest:scalatest-funsuite_2.13',
              registryUrls,
            },
            {
              currentValue: '1.17.5',
              datasource: 'sbt-package',
              depName: 'org.mockito:mockito-scala-scalatest',
              depType: 'Test',
              editFile: `${fixturesDir}/simple-project/project/Versions.scala`,
              fileReplacePosition: 14,
              groupName: 'mockito',
              packageName: 'org.mockito:mockito-scala-scalatest_2.13',
              registryUrls,
            },
            {
              currentValue: '3.1.9',
              datasource: 'sbt-package',
              depName:
                'com.softwaremill.sttp.client3:async-http-client-backend-future',
              depType: 'Test',
              editFile: `${fixturesDir}/simple-project/project/Versions.scala`,
              fileReplacePosition: 4,
              groupName: 'sttp',
              packageName:
                'com.softwaremill.sttp.client3:async-http-client-backend-future_2.13',
              registryUrls,
            },
          ],
          packageFile: `${fixturesDir}/simple-project/project/Versions.scala`,
        },
        {
          deps: [
            {
              currentValue: '1.9.3',
              datasource: 'sbt-plugin',
              depName: 'org.scoverage:sbt-scoverage',
              depType: 'plugin',
              fileReplacePosition: 2,
              packageName: 'org.scoverage:sbt-scoverage',
              registryUrls: [
                ...registryUrls,
                'https://dl.bintray.com/sbt/sbt-plugin-releases',
              ],
            },
            {
              currentValue: '1.0.1',
              datasource: 'sbt-plugin',
              depName: 'com.typesafe:sbt-mima-plugin',
              depType: 'plugin',
              fileReplacePosition: 3,
              packageName: 'com.typesafe:sbt-mima-plugin_2.13',
              registryUrls: [
                ...registryUrls,
                'https://dl.bintray.com/sbt/sbt-plugin-releases',
              ],
            },
            {
              currentValue: '0.4.3',
              datasource: 'sbt-plugin',
              depName: 'pl.project13.scala:sbt-jmh',
              depType: 'plugin',
              fileReplacePosition: 4,
              packageName: 'pl.project13.scala:sbt-jmh',
              registryUrls: [
                ...registryUrls,
                'https://dl.bintray.com/sbt/sbt-plugin-releases',
              ],
            },
          ],
          packageFile:
            'lib/modules/manager/sbt/__fixtures__/simple-project/project/plugins.sbt',
        },
      ] as PackageFile[]);
    });

    it('extract simple-project with maven resolver', async () => {
      const registryUrls = [
        'https://repo.maven.apache.org/maven2',
        'https://example.org.com/internal-maven',
      ];
      expect(
        await extractAllPackageFiles(config, [
          `${fixturesDir}/simple-project-with-resolver/build.sbt`,
          `${fixturesDir}/simple-project-with-resolver/project/plugins.sbt`,
          `${fixturesDir}/simple-project-with-resolver/project/Versions.scala`,
          `${fixturesDir}/simple-project-with-resolver/submodule/build.sbt`,
        ])
      ).toEqual([
        {
          deps: [
            {
              currentValue: '2.13.5',
              datasource: 'maven',
              depName: 'scala',
              packageName: 'org.scala-lang:scala-library',
              registryUrls,
              separateMinorPatch: true,
            },
            {
              currentValue: '1.2.11',
              datasource: 'sbt-package',
              depName: 'ch.qos.logback:logback-classic',
              fileReplacePosition: 35,
              packageName: 'ch.qos.logback:logback-classic',
              registryUrls,
            },
          ],
          packageFile: `${fixturesDir}/simple-project-with-resolver/build.sbt`,
        },
        {
          deps: [
            {
              currentValue: '0.13.0',
              datasource: 'sbt-package',
              depName: 'io.circe:circe-generic',
              editFile: `${fixturesDir}/simple-project-with-resolver/project/Versions.scala`,
              fileReplacePosition: 5,
              groupName: 'circe',
              packageName: 'io.circe:circe-generic_2.13',
              registryUrls,
            },
            {
              currentValue: '10.2.6',
              datasource: 'sbt-package',
              depName: 'com.typesafe.akka:akka-http',
              editFile: `${fixturesDir}/simple-project-with-resolver/project/Versions.scala`,
              fileReplacePosition: 3,
              groupName: 'akkaHttp',
              packageName: 'com.typesafe.akka:akka-http_2.13',
              registryUrls,
            },
            {
              currentValue: '2.6.18',
              datasource: 'sbt-package',
              depName: 'com.typesafe.akka:akka-stream',
              editFile: `${fixturesDir}/simple-project-with-resolver/project/Versions.scala`,
              fileReplacePosition: 2,
              groupName: 'akka',
              packageName: 'com.typesafe.akka:akka-stream_2.13',
              registryUrls,
            },
          ],
          packageFile: `${fixturesDir}/simple-project-with-resolver/project/Versions.scala`,
        },
        {
          deps: [
            {
              currentValue: '1.9.5',
              datasource: 'sbt-plugin',
              depName: 'org.scoverage:sbt-scoverage',
              depType: 'plugin',
              fileReplacePosition: 2,
              packageName: 'org.scoverage:sbt-scoverage',
              registryUrls: [
                ...registryUrls,
                'https://dl.bintray.com/sbt/sbt-plugin-releases',
              ],
            },
          ],
          packageFile: `${fixturesDir}/simple-project-with-resolver/project/plugins.sbt`,
        },
      ] as PackageFile[]);
    });
  });
});
