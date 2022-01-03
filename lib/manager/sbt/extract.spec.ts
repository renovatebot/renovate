import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const sbt = loadFixture(`sample.sbt`);
const sbtScalaVersionVariable = loadFixture(`scala-version-variable.sbt`);
const sbtMissingScalaVersion = loadFixture(`missing-scala-version.sbt`);
const sbtDependencyFile = loadFixture(`dependency-file.scala`);
const sbtPrivateVariableDependencyFile = loadFixture(
  `private-variable-dependency-file.scala`
);

describe('manager/sbt/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile(null)).toBeNull();
      expect(extractPackageFile('non-sense')).toBeNull();
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
      expect(
        extractPackageFile('libraryDependencies += "foo" % "bar" % "baz" %%')
      ).toBeNull();
    });
    it('extracts deps for generic use-cases', () => {
      expect(extractPackageFile(sbt)).toMatchSnapshot({
        deps: [
          {
            lookupName: 'org.scala-lang:scala-library',
            currentValue: '2.9.10',
          },
          { lookupName: 'org.example:foo', currentValue: '0.0.1' },
          { lookupName: 'org.example:bar_2.9.10', currentValue: '0.0.2' },
          { lookupName: 'org.example:baz_2.9.10', currentValue: '0.0.3' },
          { lookupName: 'org.example:qux', currentValue: '0.0.4' },
          {
            lookupName: 'org.scala-lang:scala-library',
            currentValue: '2.13.3',
          },
          { lookupName: 'org.example:quux', currentValue: '0.0.5' },
          { lookupName: 'org.example:quuz_2.9.10', currentValue: '0.0.6' },
          { lookupName: 'org.example:corge', currentValue: '0.0.7' },
          { lookupName: 'org.example:grault', currentValue: '0.0.8' },
          { lookupName: 'org.example:waldo', currentValue: '0.0.9' },
          { lookupName: 'org.example:fred', currentValue: '(,8.4.0]' },
        ],
        packageFileVersion: '1.0',
      });
    });
    it('extracts deps when scala version is defined in a variable', () => {
      expect(extractPackageFile(sbtScalaVersionVariable)).toMatchSnapshot({
        deps: [
          { lookupName: 'org.example:foo', currentValue: '0.0.1' },
          { lookupName: 'org.example:bar_2.12', currentValue: '0.0.2' },
          { lookupName: 'org.example:baz_2.12', currentValue: '0.0.3' },
          { lookupName: 'org.example:qux', currentValue: '0.0.4' },
          { lookupName: 'org.example:quux', currentValue: '0.0.5' },
          { lookupName: 'org.example:quuz_2.12', currentValue: '0.0.6' },
          { lookupName: 'org.example:corge', currentValue: '0.0.7' },
          { lookupName: 'org.example:grault', currentValue: '0.0.8' },
          { lookupName: 'org.example:waldo', currentValue: '0.0.9' },
        ],

        packageFileVersion: '3.2.1',
      });
    });
    it('skips deps when scala version is missing', () => {
      expect(extractPackageFile(sbtMissingScalaVersion)).toEqual({
        deps: [
          {
            currentValue: '3.0.0',
            datasource: 'sbt-package',
            depName: 'org.scalatest:scalatest',
            lookupName: 'org.scalatest:scalatest',
            registryUrls: ['https://repo.maven.apache.org/maven2'],
          },
          {
            currentValue: '1.0.11',
            datasource: 'sbt-plugin',
            depName: 'com.github.gseitz:sbt-release',
            depType: 'plugin',
            groupName: 'sbtReleaseVersion for com.github.gseitz',
            lookupName: 'com.github.gseitz:sbt-release',
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
            lookupName: 'org.scala-lang:scala-library',
            currentValue: '2.13.0-RC5',
          },
          {
            lookupName: 'com.example:foo_2.13.0-RC5',
            currentValue: '0.7.1',
          },
          { lookupName: 'com.abc:abc', currentValue: '1.2.3' },
          { lookupName: 'com.abc:abc-a', currentValue: '1.2.3' },
          { lookupName: 'com.abc:abc-b', currentValue: '1.2.3' },
          { lookupName: 'com.abc:abc-c', currentValue: '1.2.3' },
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
            lookupName: 'org.scala-lang:scala-library',
            currentValue: '2.12.10',
          },
          {
            lookupName: 'org.example:bar_2.12',
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
        deps: [{ lookupName: 'org.example:bar_2.12', currentValue: '0.0.2' }],
      });
    });
    it('extract deps from native scala file with private variables', () => {
      expect(
        extractPackageFile(sbtPrivateVariableDependencyFile)
      ).toMatchSnapshot({
        deps: [
          {
            lookupName: 'org.scala-lang:scala-library',
            currentValue: '2.13.0-RC5',
          },
          {
            lookupName: 'com.example:foo_2.13.0-RC5',
            currentValue: '0.7.1',
          },
          {
            lookupName: 'com.abc:abc',
            currentValue: '1.2.3',
          },
        ],
        packageFileVersion: undefined,
      });
    });
  });
});
