import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { REGISTRY_URLS } from '../gradle/parser/common';
import type { ExtractConfig, PackageFile } from '../types';
import {
  extractPackageFile as extract,
  extractAllPackageFiles,
} from './extract';

const extractPackageFile = (content: string) =>
  extract(content, {
    packageFile: 'build.sbt',
    localVars: {},
    globalVars: {},
    deps: [],
  });

const fixturesDir = 'lib/modules/manager/sbt/__fixtures__';

const sbt = Fixtures.get(`sample.sbt`);
const sbtScalaVersionVariable = Fixtures.get(`scala-version-variable.sbt`);
const sbtMissingScalaVersion = Fixtures.get(`missing-scala-version.sbt`);
const sbtDependencyFile = Fixtures.get(`dependency-file.scala`);
const sbtPrivateVariableDependencyFile = Fixtures.get(
  `private-variable-dependency-file.scala`
);

describe('modules/manager/sbt/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('')).toBeNull();
      expect(extractPackageFile('non-sense')).toBeNull();
      expect(extractPackageFile('version := "1.2.3"')).toMatchSnapshot({
        deps: [],
        globalVars: {},
        localVars: {},
        packageFile: 'build.sbt',
        packageFileVersion: '1.2.3',
        registryUrls: ['https://repo.maven.apache.org/maven2'],
        scalaVersion: undefined,
      });
      expect(
        extractPackageFile('libraryDependencies += "foo" % "bar" % ???')
      ).toBeNull();
      expect(
        extractPackageFile('libraryDependencies += "foo" % "bar" %% "baz"')
      ).toBeNull();
      expect(
        extractPackageFile('libraryDependencies += ??? % "bar" % "baz"')
      ).toBeNull();
      expect(
        extractPackageFile('libraryDependencies += "foo" % ??? % "baz"')
      ).toBeNull();

      expect(extractPackageFile('libraryDependencies += ')).toBeNull();
      expect(extractPackageFile('libraryDependencies += "foo"')).toBeNull();
      expect(
        extractPackageFile('libraryDependencies += "foo" % "bar" %')
      ).toBeNull();
    });

    it('extracts deps for generic use-cases', () => {
      expect(extractPackageFile(sbt)).toMatchSnapshot({
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
          { packageName: 'org.example:abc_2.9.10', currentValue: '0.0.42' },
          { packageName: 'org.example:corge', currentValue: '0.0.7' },
          { packageName: 'org.example:grault', currentValue: '0.0.8' },
          { packageName: 'org.example:waldo', currentValue: '0.0.9' },
          { packageName: 'org.example:fred', currentValue: '(,8.4.0]' },
        ],
        packageFileVersion: '1.0',
      });
    });

    it('extracts deps when scala version is defined in a variable', () => {
      expect(extractPackageFile(sbtScalaVersionVariable)).toMatchSnapshot({
        deps: [
          {
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.12.10',
          },
          { packageName: 'org.example:foo', currentValue: '0.0.1' },
          { packageName: 'org.example:bar_2.12', currentValue: '0.0.2' },
          { packageName: 'org.example:baz_2.12', currentValue: '0.0.3' },
          { packageName: 'org.example:qux', currentValue: '0.0.4' },
          { packageName: 'org.example:quux', currentValue: '0.0.5' },
          { packageName: 'org.example:quuz_2.12', currentValue: '0.0.6' },
          { packageName: 'org.example:corge', currentValue: '0.0.7' },
          { packageName: 'org.example:grault', currentValue: '0.0.8' },
          {
            datasource: 'sbt-plugin',
            packageName: 'org.example:waldo',
            currentValue: '0.0.9',
          },
        ],
        packageFileVersion: '3.2.1',
      });
    });

    it('extracts packageFileVersion when scala version is defined in a variable', () => {
      const content = `
        val fileVersion = "1.2.3"
        version := fileVersion
        libraryDependencies += "foo" % "bar" % "0.0.1"
      `;
      expect(extractPackageFile(content)).toMatchObject({
        packageFileVersion: '1.2.3',
      });
    });

    it('extracts typed variables', () => {
      const content = `
        val version: String = "1.2.3"
        libraryDependencies += "foo" % "bar" % version
      `;
      expect(extractPackageFile(content)).toMatchObject({
        deps: [
          {
            currentValue: '1.2.3',
            groupName: 'version',
          },
        ],
      });
    });

    it('skips deps when scala version is missing', () => {
      expect(extractPackageFile(sbtMissingScalaVersion)).toEqual({
        deps: [
          {
            currentValue: '3.0.0',
            datasource: 'sbt-package',
            depName: 'org.scalatest:scalatest',
            packageName: 'org.scalatest:scalatest',
            registryUrls: ['https://repo.maven.apache.org/maven2'],
          },
          {
            currentValue: '1.0.11',
            datasource: 'sbt-plugin',
            depName: 'com.github.gseitz:sbt-release',
            depType: 'plugin',
            editFile: 'build.sbt',
            fileReplacePosition: 6,
            groupName: 'sbtReleaseVersion',
            packageName: 'com.github.gseitz:sbt-release',
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases',
            ],
            variableName: 'sbtReleaseVersion',
          },
        ],
        globalVars: {},
        localVars: {
          sbtReleaseVersion: {
            lineIndex: 6,
            sourceFile: 'build.sbt',
            val: '1.0.11',
          },
        },
        packageFile: 'build.sbt',
        packageFileVersion: '1.0.1',
        registryUrls: ['https://repo.maven.apache.org/maven2'],
        scalaVersion: undefined,
      });
    });

    it('extract deps from native scala file with variables', () => {
      expect(extractPackageFile(sbtDependencyFile)).toMatchSnapshot({
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
      expect(extractPackageFile(content)).toMatchSnapshot({
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
      expect(extractPackageFile(content)).toMatchSnapshot({
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

    it('extracts deps when scala version is defined with ThisBuild scope', () => {
      const content = `
        ThisBuild / scalaVersion := "2.12.10"
        libraryDependencies += "org.example" %% "bar" % "0.0.2"
      `;
      expect(extractPackageFile(content)).toMatchSnapshot({
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

    it('extracts correct scala library when dealing with scala 3', () => {
      const content = `
        scalaVersion := "3.1.1"
      `;

      expect(extractPackageFile(content)).toMatchObject({
        deps: [
          {
            packageName: 'org.scala-lang:scala3-library_3',
            currentValue: '3.1.1',
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
      expect(extractPackageFile(content)).toMatchSnapshot({
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

    it('extract deps from native scala file with private variables', () => {
      expect(
        extractPackageFile(sbtPrivateVariableDependencyFile)
      ).toMatchSnapshot({
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
      expect(extractPackageFile(content)).toMatchObject({
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
      });
    });

    it('extract deps with comment', () => {
      const content = `
      name := "service"
      scalaVersion := "2.13.8" // scalaVersion
      lazy val compileDependencies =
        Seq(
          "com.typesafe.scala-logging" %% "scala-logging" % "3.9.4", /** critical lib */
          "ch.qos.logback" % "logback-classic" % "1.2.10" // common lib
        )
      `;
      expect(extractPackageFile(content)).toMatchObject({
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
      });
    });

    it('extract addCompilerPlugin', () => {
      expect(
        extractPackageFile(`
        addCompilerPlugin("org.scala-tools.sxr" %% "sxr" % "0.3.0")
        `)
      ).toMatchObject({
        deps: [
          {
            datasource: 'sbt-plugin',
            packageName: 'org.scala-tools.sxr:sxr',
            currentValue: '0.3.0',
          },
        ],
      });
    });

    it('extract sbt version', () => {
      expect(
        extract(
          codeBlock`
            sbt.version=1.6.0
          `,
          {
            packageFile: 'project/build.properties',
            localVars: {},
            globalVars: {},
            deps: [],
          }
        )
      ).toMatchObject({
        deps: [
          {
            datasource: 'github-releases',
            packageName: 'sbt/sbt',
            depName: 'sbt/sbt',
            currentValue: '1.6.0',
            replaceString: 'sbt.version=1.6.0',
            versioning: 'semver',
            extractVersion: '^v(?<version>\\S+)',
          },
        ],
      });
    });

    it('extract sbt version if the file contains other properties', () => {
      expect(
        extract(
          codeBlock`
            sbt.version=1.6.0
            another.conf=1.4.0
          `,
          {
            packageFile: 'project/build.properties',
            localVars: {},
            globalVars: {},
            deps: [],
          }
        )
      ).toMatchObject({
        deps: [
          {
            datasource: 'github-releases',
            packageName: 'sbt/sbt',
            depName: 'sbt/sbt',
            currentValue: '1.6.0',
            replaceString: 'sbt.version=1.6.0',
            versioning: 'semver',
            extractVersion: '^v(?<version>\\S+)',
          },
        ],
      });
    });

    it('ignores build.properties file if does not contain sbt version', () => {
      expect(
        extract(
          codeBlock`
            another.conf=1.4.0
          `,
          {
            packageFile: 'project/build.properties',
            localVars: {},
            globalVars: {},
            deps: [],
          }
        )
      ).toBeNull();
    });
  });

  describe('extractAllPackageFiles()', () => {
    const config: ExtractConfig = {};

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('extract simple-project with Versions.scala variable file', async () => {
      const adminConfig: RepoGlobalConfig = {
        localDir: `${fixturesDir}/simple-project`,
      };
      GlobalConfig.set(adminConfig);
      const registryUrls = [
        REGISTRY_URLS.mavenCentral,
        'https://repo-company.com/maven-local-snapshot',
        'https://repo-company.com/maven',
      ];
      expect(
        await extractAllPackageFiles(config, [
          `build.sbt`,
          `project/plugins.sbt`,
          `project/Versions.scala`,
          `submodule/build.sbt`,
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
              packageName: 'ch.qos.logback:logback-classic',
              registryUrls,
            },
          ],
          packageFile: 'build.sbt',
        },
        {
          deps: [
            {
              currentValue: '0.13.0',
              datasource: 'sbt-package',
              depName: 'io.circe:circe-generic',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 7,
              groupName: 'circe',
              packageName: 'io.circe:circe-generic_2.13',
              registryUrls,
              variableName: 'circe',
            },
            {
              currentValue: '10.2.6',
              datasource: 'sbt-package',
              depName: 'com.typesafe.akka:akka-http',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 3,
              groupName: 'akkaHttp',
              packageName: 'com.typesafe.akka:akka-http_2.13',
              registryUrls,
              variableName: 'akkaHttp',
            },
            {
              currentValue: '2.6.18',
              datasource: 'sbt-package',
              depName: 'com.typesafe.akka:akka-stream',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 2,
              groupName: 'akka',
              packageName: 'com.typesafe.akka:akka-stream_2.13',
              registryUrls,
              variableName: 'akka',
            },
            {
              currentValue: '1.3.1',
              datasource: 'sbt-package',
              depName: 'org.sangria-graphql:sangria-circe',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 6,
              groupName: 'sangriacirce',
              packageName: 'org.sangria-graphql:sangria-circe_2.13',
              registryUrls,
              variableName: 'sangriacirce',
            },
            {
              currentValue: '3.2.11',
              datasource: 'sbt-package',
              depName: 'org.scalatest:scalatest-wordspec',
              depType: 'Test',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 13,
              groupName: 'scalaTest',
              packageName: 'org.scalatest:scalatest-wordspec_2.13',
              registryUrls,
              variableName: 'scalaTest',
            },
            {
              currentValue: '3.2.11',
              datasource: 'sbt-package',
              depName: 'org.scalatest:scalatest-funsuite',
              depType: 'Test',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 13,
              groupName: 'scalaTest',
              packageName: 'org.scalatest:scalatest-funsuite_2.13',
              registryUrls,
              variableName: 'scalaTest',
            },
            {
              currentValue: '1.17.5',
              datasource: 'sbt-package',
              depName: 'org.mockito:mockito-scala-scalatest',
              depType: 'Test',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 14,
              groupName: 'mockito',
              packageName: 'org.mockito:mockito-scala-scalatest_2.13',
              registryUrls,
              variableName: 'mockito',
            },
            {
              currentValue: '3.1.9',
              datasource: 'sbt-package',
              depName:
                'com.softwaremill.sttp.client3:async-http-client-backend-future',
              depType: 'Test',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 4,
              groupName: 'sttp',
              packageName:
                'com.softwaremill.sttp.client3:async-http-client-backend-future_2.13',
              registryUrls,
              variableName: 'sttp',
            },
          ],
          packageFile: `project/Versions.scala`,
        },
        {
          deps: [
            {
              currentValue: '1.9.3',
              datasource: 'sbt-plugin',
              depName: 'org.scoverage:sbt-scoverage',
              depType: 'plugin',
              packageName: 'org.scoverage:sbt-scoverage',
              registryUrls: [
                ...registryUrls,
                'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases',
              ],
            },
            {
              currentValue: '1.0.1',
              datasource: 'sbt-plugin',
              depName: 'com.typesafe:sbt-mima-plugin',
              depType: 'plugin',
              packageName: 'com.typesafe:sbt-mima-plugin_2.13',
              registryUrls: [
                ...registryUrls,
                'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases',
              ],
            },
            {
              currentValue: '0.4.3',
              datasource: 'sbt-plugin',
              depName: 'pl.project13.scala:sbt-jmh',
              depType: 'plugin',
              packageName: 'pl.project13.scala:sbt-jmh',
              registryUrls: [
                ...registryUrls,
                'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases',
              ],
            },
          ],
          packageFile: 'project/plugins.sbt',
        },
        {
          deps: [
            {
              currentValue: undefined,
              datasource: 'sbt-package',
              depName: 'com.github.tomakehurst:wiremock-jre8',
              depType: 'Test',
              packageName: 'com.github.tomakehurst:wiremock-jre8',
              registryUrls,
            },
          ],
          packageFile: 'submodule/build.sbt',
        },
      ] as PackageFile[]);
    });

    it('extract simple-project with maven resolver', async () => {
      const adminConfig: RepoGlobalConfig = {
        localDir: `${fixturesDir}/simple-project-with-resolver`,
      };
      GlobalConfig.set(adminConfig);

      const registryUrls = [
        'https://repo.maven.apache.org/maven2',
        'https://example.org.com/internal-maven',
      ];
      expect(
        await extractAllPackageFiles(config, [
          `build.sbt`,
          `project/plugins.sbt`,
          `project/Versions.scala`,
          `submodule/build.sbt`,
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
              packageName: 'ch.qos.logback:logback-classic',
              registryUrls,
            },
          ],
          packageFile: `build.sbt`,
        },
        {
          deps: [
            {
              currentValue: '0.13.0',
              datasource: 'sbt-package',
              depName: 'io.circe:circe-generic',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 5,
              groupName: 'circe',
              packageName: 'io.circe:circe-generic_2.13',
              registryUrls,
              variableName: 'circe',
            },
            {
              currentValue: '10.2.6',
              datasource: 'sbt-package',
              depName: 'com.typesafe.akka:akka-http',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 3,
              groupName: 'akkaHttp',
              packageName: 'com.typesafe.akka:akka-http_2.13',
              registryUrls,
              variableName: 'akkaHttp',
            },
            {
              currentValue: '2.6.18',
              datasource: 'sbt-package',
              depName: 'com.typesafe.akka:akka-stream',
              editFile: `project/Versions.scala`,
              fileReplacePosition: 2,
              groupName: 'akka',
              packageName: 'com.typesafe.akka:akka-stream_2.13',
              registryUrls,
              variableName: 'akka',
            },
          ],
          packageFile: `project/Versions.scala`,
        },
        {
          deps: [
            {
              currentValue: '1.9.5',
              datasource: 'sbt-plugin',
              depName: 'org.scoverage:sbt-scoverage',
              depType: 'plugin',
              packageName: 'org.scoverage:sbt-scoverage',
              registryUrls: [
                ...registryUrls,
                'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases',
              ],
            },
          ],
          packageFile: `project/plugins.sbt`,
        },
      ] as PackageFile[]);
    });
  });
});
