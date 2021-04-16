import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const sbt = readFileSync(
  resolve(__dirname, `./__fixtures__/sample.sbt`),
  'utf8'
);
const sbtScalaVersionVariable = readFileSync(
  resolve(__dirname, `./__fixtures__/scala-version-variable.sbt`),
  'utf8'
);
const sbtMissingScalaVersion = readFileSync(
  resolve(__dirname, `./__fixtures__/missing-scala-version.sbt`),
  'utf8'
);

const sbtDependencyFile = readFileSync(
  resolve(__dirname, `./__fixtures__/dependency-file.scala`),
  'utf8'
);

const sbtPrivateVariableDependencyFile = readFileSync(
  resolve(__dirname, `./__fixtures__/private-variable-dependency-file.scala`),
  'utf8'
);

describe(getName(__filename), () => {
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
      expect(extractPackageFile(sbt)).toMatchSnapshot();
    });
    it('extracts deps when scala version is defined in a variable', () => {
      expect(extractPackageFile(sbtScalaVersionVariable)).toMatchSnapshot();
    });
    it('skips deps when scala version is missing', () => {
      expect(extractPackageFile(sbtMissingScalaVersion)).toMatchSnapshot();
    });
    it('extract deps from native scala file with variables', () => {
      expect(extractPackageFile(sbtDependencyFile)).toMatchSnapshot();
    });
    it('extracts deps when scala version is defined with a trailing comma', () => {
      const content = `
        lazy val commonSettings = Seq(
          scalaVersion := "2.12.10",
        )
        libraryDependencies += "org.example" %% "bar" % "0.0.2"
      `;
      expect(extractPackageFile(content)).toMatchSnapshot();
    });
    it('extracts deps when scala version is defined in a variable with a trailing comma', () => {
      const content = `
        val ScalaVersion = "2.12.10"
        lazy val commonSettings = Seq(
          scalaVersion := ScalaVersion,
        )
        libraryDependencies += "org.example" %% "bar" % "0.0.2"
      `;
      expect(extractPackageFile(content)).toMatchSnapshot();
    });
    it('extract deps from native scala file with private variables', () => {
      expect(
        extractPackageFile(sbtPrivateVariableDependencyFile)
      ).toMatchSnapshot();
    });
  });
});
