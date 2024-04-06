import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import {
  extractPackageFile as extract,
  extractAllPackageFiles,
} from './extract';

jest.mock('../../../util/fs');

const extractPackageFile = (content: string) => extract(content, 'build.sbt');

const sbt = Fixtures.get(`sample.sbt`);
const sbtScalaVersionVariable = Fixtures.get(`scala-version-variable.sbt`);
const sbtMissingScalaVersion = Fixtures.get(`missing-scala-version.sbt`);
const sbtDependencyFile = Fixtures.get(`dependency-file.scala`);
const sbtPrivateVariableDependencyFile = Fixtures.get(
  `private-variable-dependency-file.scala`,
);

describe('modules/manager/sbt/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('')).toBeNull();
      expect(extractPackageFile('non-sense')).toBeNull();
      expect(extractPackageFile('version := "1.2.3"')).toBeNull();
      expect(
        extractPackageFile('libraryDependencies += "foo" % "bar" % ???'),
      ).toBeNull();
      expect(
        extractPackageFile('libraryDependencies += "foo" % "bar" %% "baz"'),
      ).toBeNull();
      expect(
        extractPackageFile('libraryDependencies += ??? % "bar" % "baz"'),
      ).toBeNull();
      expect(
        extractPackageFile('libraryDependencies += "foo" % ??? % "baz"'),
      ).toBeNull();

      expect(extractPackageFile('libraryDependencies += ')).toBeNull();
      expect(extractPackageFile('libraryDependencies += "foo"')).toBeNull();
      expect(
        extractPackageFile('libraryDependencies += "foo" % "bar" %'),
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
            registryUrls: [],
          },
          {
            currentValue: '1.0.11',
            datasource: 'sbt-plugin',
            depName: 'com.github.gseitz:sbt-release',
            depType: 'plugin',
            groupName: 'sbtReleaseVersion',
            packageName: 'com.github.gseitz:sbt-release',
            registryUrls: [],
            variableName: 'sbtReleaseVersion',
          },
        ],
        packageFileVersion: '1.0.1',
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
        extractPackageFile(sbtPrivateVariableDependencyFile),
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
      expect(extractPackageFile(content)).toMatchObject({
        deps: [
          {
            registryUrls: [],
            datasource: 'maven',
            depName: 'scala',
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.13.8',
            separateMinorPatch: true,
          },
          {
            registryUrls: [],
            depName: 'com.typesafe.scala-logging:scala-logging',
            packageName: 'com.typesafe.scala-logging:scala-logging_2.13',
            currentValue: '3.9.4',
            datasource: 'sbt-package',
          },
          {
            registryUrls: [],
            depName: 'ch.qos.logback:logback-classic',
            packageName: 'ch.qos.logback:logback-classic',
            currentValue: '1.2.10',
            datasource: 'sbt-package',
          },
        ],
        packageFileVersion: undefined,
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
            registryUrls: [],
            datasource: 'maven',
            depName: 'scala',
            packageName: 'org.scala-lang:scala-library',
            currentValue: '2.13.8',
            separateMinorPatch: true,
          },
          {
            registryUrls: [],
            depName: 'com.typesafe.scala-logging:scala-logging',
            packageName: 'com.typesafe.scala-logging:scala-logging_2.13',
            currentValue: '3.9.4',
            datasource: 'sbt-package',
          },
          {
            registryUrls: [],
            depName: 'ch.qos.logback:logback-classic',
            packageName: 'ch.qos.logback:logback-classic',
            currentValue: '1.2.10',
            datasource: 'sbt-package',
          },
        ],
        packageFileVersion: undefined,
      });
    });

    it('extract addCompilerPlugin', () => {
      expect(
        extractPackageFile(`
        addCompilerPlugin("org.scala-tools.sxr" %% "sxr" % "0.3.0")
        `),
      ).toMatchObject({
        deps: [
          {
            datasource: 'sbt-plugin',
            packageName: 'org.scala-tools.sxr:sxr',
            currentValue: '0.3.0',
          },
        ],
        packageFileVersion: undefined,
      });
    });

    it('extract sbt version', () => {
      expect(
        extract(
          codeBlock`
            sbt.version=1.6.0
          `,
          'project/build.properties',
        ),
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
          'project/build.properties',
        ),
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
          'project/build.properties',
        ),
      ).toBeNull();
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('extracts proxy repositories', async () => {
      const repositoryContent = codeBlock`
      [repositories]
      local
      my-maven-repo: http://example.org/repo
      my-ivy-repo: https://example.org/ivy-repo/, [organization]/[module]/[revision]/[type]s/[artifact](-[classifier]).[ext]
      maven-central
    `;
      fs.readLocalFile
        .mockResolvedValueOnce(repositoryContent)
        .mockResolvedValueOnce(sbtDependencyFile);
      const packages = await extractAllPackageFiles({}, [
        'repositories',
        'build.sbt',
      ]);
      const expected_packages = [
        {
          deps: [
            {
              packageName: 'org.scala-lang:scala-library',
              currentValue: '2.13.0-RC5',
              registryUrls: [
                'http://example.org/repo',
                'https://example.org/ivy-repo/',
                'https://repo1.maven.org/maven2',
              ],
            },
            {
              packageName: 'com.example:foo_2.13.0-RC5',
              currentValue: '0.7.1',
              registryUrls: [
                'http://example.org/repo',
                'https://example.org/ivy-repo/',
                'https://repo1.maven.org/maven2',
              ],
            },
            {
              packageName: 'com.abc:abc',
              currentValue: '1.2.3',
              registryUrls: [
                'http://example.org/repo',
                'https://example.org/ivy-repo/',
                'https://repo1.maven.org/maven2',
              ],
            },
            {
              packageName: 'com.abc:abc-a',
              currentValue: '1.2.3',
              registryUrls: [
                'http://example.org/repo',
                'https://example.org/ivy-repo/',
                'https://repo1.maven.org/maven2',
              ],
            },
            {
              packageName: 'com.abc:abc-b',
              currentValue: '1.2.3',
              registryUrls: [
                'http://example.org/repo',
                'https://example.org/ivy-repo/',
                'https://repo1.maven.org/maven2',
              ],
            },
            {
              packageName: 'com.abc:abc-c',
              currentValue: '1.2.3',
              registryUrls: [
                'http://example.org/repo',
                'https://example.org/ivy-repo/',
                'https://repo1.maven.org/maven2',
              ],
            },
          ],
        },
      ];
      expect(packages).toMatchObject(expected_packages);
    });

    it('should include default registryUrls if no repositories file is provided', async () => {
      fs.readLocalFile.mockResolvedValueOnce(sbt);
      const packages = await extractAllPackageFiles({}, ['build.sbt']);
      for (const pkg of packages) {
        for (const dep of pkg.deps.filter((d) => d.depType === 'plugin')) {
          expect(dep.registryUrls).toStrictEqual([
            'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases',
            'https://repo1.maven.org/maven2',
            'https://example.com/repos/1/',
            'https://example.com/repos/2/',
            'https://example.com/repos/3/',
            'https://example.com/repos/4/',
            'https://example.com/repos/5/',
          ]);
        }
      }
      for (const pkg of packages) {
        for (const dep of pkg.deps.filter((d) => d.depType !== 'plugin')) {
          expect(dep.registryUrls).toStrictEqual([
            'https://repo1.maven.org/maven2',
            'https://example.com/repos/1/',
            'https://example.com/repos/2/',
            'https://example.com/repos/3/',
            'https://example.com/repos/4/',
            'https://example.com/repos/5/',
          ]);
        }
      }
    });

    it('should return empty packagefiles is no content is provided', async () => {
      fs.readLocalFile.mockResolvedValueOnce('');
      const packages = await extractAllPackageFiles({}, ['build.sbt']);
      expect(packages).toBeEmpty();
    });

    it('extracts build properties correctly', async () => {
      const buildProps = codeBlock`
      sbt.version=1.6.0
    `;
      fs.readLocalFile.mockResolvedValueOnce(buildProps);
      const packages = await extractAllPackageFiles({}, [
        'project/build.properties',
      ]);
      expect(packages).toMatchObject([
        {
          deps: [
            {
              datasource: 'github-releases',
              packageName: 'sbt/sbt',
              depName: 'sbt/sbt',
              currentValue: '1.6.0',
              replaceString: 'sbt.version=1.6.0',
              versioning: 'semver',
              extractVersion: '^v(?<version>\\S+)',
              registryUrls: [],
            },
          ],
        },
      ]);
    });
  });
});
