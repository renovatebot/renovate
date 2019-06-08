const fs = require('fs');
const path = require('path');
const { extractPackageFile } = require('../../../lib/manager/swift/extract');

const pkgContent = fs.readFileSync(
  path.resolve(__dirname, `./_fixtures/SamplePackage.swift`),
  'utf8'
);

describe('lib/manager/swift', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty content', () => {
      expect(extractPackageFile(null)).toBeNull();
      expect(extractPackageFile(``)).toBeNull();
      expect(extractPackageFile(`dependencies:[]`)).toBeNull();
      expect(extractPackageFile(`dependencies:["foobar"]`)).toBeNull();
    });
    it('returns null for invalid content', () => {
      expect(extractPackageFile(`dependen`)).toBeNull();
      expect(extractPackageFile(`dependencies!: `)).toBeNull();
      expect(extractPackageFile(`dependencies :`)).toBeNull();
      expect(extractPackageFile(`dependencies...`)).toBeNull();
      expect(extractPackageFile(`dependencies:!`)).toBeNull();
      expect(extractPackageFile(`dependencies:[`)).toBeNull();
      expect(extractPackageFile(`dependencies:[...`)).toBeNull();
      expect(extractPackageFile(`dependencies:[]`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package.package(`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(asdf`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package]`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(]`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(.package(`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(]`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(url],`)).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url.package(]`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:.package(`)
      ).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(url:]`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(url:"fo`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(url:"fo]`)).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo"]`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo".package(]`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo", ]`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo", .package(]`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo", .exact(]`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo", from]`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo", from.package(`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo", from:]`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo", from:.package(`)
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo","1.2.3")]`)
      ).toBeNull();
    });
    it('parses package descriptions', () => {
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo",from:"1.2.3")]`)
      ).toMatchSnapshot();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo","1.2.3"...)]`)
      ).toMatchSnapshot();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"foo","1.2.3"..."1.2.4")]`
        )
      ).toMatchSnapshot();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"foo","1.2.3"..<"1.2.4")]`
        )
      ).toMatchSnapshot();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo",..."1.2.3")]`)
      ).toMatchSnapshot();
      expect(
        extractPackageFile(`dependencies:[.package(url:"foo",..<"1.2.3")]`)
      ).toMatchSnapshot();
    });
    it('parses multiple packages', () => {
      expect(extractPackageFile(pkgContent)).toMatchSnapshot();
    });
  });
});
// TODO: test ranges
// "a..."  for [a, )
// "...b"  for (, b]
// "..<b"  for (, b)
