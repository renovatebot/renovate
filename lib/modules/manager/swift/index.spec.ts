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
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from.package(`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from:]`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from:.package(`,
        ),
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3")]`,
        ),
      ).toBeNull();
    });

    it.each`
      extraArgs
      ${''}
      ${', traits: []'}
      ${', traits: [.defaults]'}
      ${', traits: [\n.trait(name: "CUSTOM_TRAIT"),\n.trait(name: "ANOTHER_TRAIT")\n]'}
    `('parses package descriptions', ({ extraArgs }) => {
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",from:"1.2.3"${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: 'from:"1.2.3"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"...${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '"1.2.3"...' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"..."1.2.4"${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '"1.2.3"..."1.2.4"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"..<"1.2.4"${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '"1.2.3"..<"1.2.4"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",..."1.2.3"${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '..."1.2.3"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",..<"1.2.3"${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '..<"1.2.3"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",.exact("1.2.3")${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '1.2.3' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",exact:"1.2.3"${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '1.2.3' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",.branch("main")${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '"main"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",branch:"develop"${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '"develop"' }] });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",.revision("c9fec45276bda81f30970316de8de246398ee1c1")${extraArgs})]`,
        ),
      ).toMatchObject({
        deps: [{ currentValue: '"c9fec45276bda81f30970316de8de246398ee1c1"' }],
      });
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",revision:"abc123"${extraArgs})]`,
        ),
      ).toMatchObject({ deps: [{ currentValue: '"abc123"' }] });
    });

    it('parses multiple packages', () => {
      expect(
        extractPackageFile(Fixtures.get(`SamplePackage.swift`)),
      ).toMatchSnapshot();
    });
  });
});
