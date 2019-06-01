const fs = require('fs');
const path = require('path');
const { extractPackageFile } = require('../../../lib/manager/sbt/extract');

const sbt = fs.readFileSync(
  path.resolve(__dirname, `./_fixtures/sample.sbt`),
  'utf8'
);
const sbtMissingScalaVersion = fs.readFileSync(
  path.resolve(__dirname, `./_fixtures/missing-scala-version.sbt`),
  'utf8'
);

describe('lib/manager/terraform/extract', () => {
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
    it('skips deps when scala version is missing', () => {
      expect(extractPackageFile(sbtMissingScalaVersion)).toMatchSnapshot();
    });
  });
});
