import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/swift/index', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty content', () => {
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
        extractPackageFile(`dependencies:[.package(url.package(]`),
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(url:.package(`),
      ).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(url:]`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(url:"fo`)).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(url:"fo]`)).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://example.com/something.git"]`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git"]`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git".package(]`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", ]`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", .package(]`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", .exact(]`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", exact:]`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", exact:.package()]`,
        ),
      ).toBeNull();
    });

    it('parses packages with invalid versions', () => {
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from]`,
        ),
      ).not.toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from.package(`,
        ),
      ).not.toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from:]`,
        ),
      ).not.toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from:.package(`,
        ),
      ).not.toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3")]`,
        ),
      ).not.toBeNull();
    });

    it('parses package descriptions', () => {
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",from:"1.2.3")]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: 'from:"1.2.3"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"...)]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '"1.2.3"...' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"..."1.2.4")]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '"1.2.3"..."1.2.4"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"..<"1.2.4")]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '"1.2.3"..<"1.2.4"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",..."1.2.3")]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '..."1.2.3"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",..<"1.2.3")]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '..<"1.2.3"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",.exact("1.2.3"))]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '1.2.3' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",exact:"1.2.3"))]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '1.2.3' }] });
    });

    it('parses multiple packages', () => {
      expect(extractPackageFile(Fixtures.get(`SamplePackage.swift`)))
        .toMatchInlineSnapshot(`
        {
          "deps": [
            {
              "currentValue": ""master"
                ",
              "datasource": "github-tags",
              "depName": "0x7fs/CountedSet",
            },
            {
              "currentValue": "from: "1.2.3"",
              "datasource": "github-tags",
              "depName": "foo/bar",
            },
            {
              "currentValue": "0.1.0",
              "datasource": "github-tags",
              "depName": "avito-tech/GraphiteClient",
            },
            {
              "currentValue": "1.0.16",
              "datasource": "github-tags",
              "depName": "IBM-Swift/BlueSignals",
            },
            {
              "currentValue": "1.2.1",
              "datasource": "github-tags",
              "depName": "apple/swift-argument-parser",
            },
            {
              "currentValue": ""UpdateSocket"
                ",
              "datasource": "github-tags",
              "depName": "beefon/Shout",
            },
            {
              "currentValue": "3.0.6",
              "datasource": "github-tags",
              "depName": "daltoniam/Starscream",
            },
            {
              "currentValue": "1.4.6",
              "datasource": "github-tags",
              "depName": "httpswift/swifter",
            },
            {
              "currentValue": "from : "0.9.6"",
              "datasource": "github-tags",
              "depName": "weichsel/ZIPFoundation",
            },
            {
              "currentValue": ""swift-5.0-branch"
            ",
              "datasource": "github-tags",
              "depName": "apple/swift-package-manager",
            },
          ],
        }
      `);
    });
  });
});
