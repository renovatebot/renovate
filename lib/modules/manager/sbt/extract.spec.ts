import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile as extract } from '.';

const extractPackageFile = (content: string) => extract(content, 'build.sbt');

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
      expect(extractPackageFile('version := "1.2.3"')).toBeNull();
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
            groupName: 'sbtReleaseVersion',
            packageName: 'com.github.gseitz:sbt-release',
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://dl.bintray.com/sbt/sbt-plugin-releases',
            ],
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
        packageFileVersion: undefined,
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
        packageFileVersion: undefined,
      });
    });
  });
});
