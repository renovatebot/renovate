import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

const pkgContent = readFileSync(
  resolve(__dirname, `./__fixtures__/SamplePackage.swift`),
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
        extractPackageFile(
          `dependencies:[.package(url:"https://example.com/something.git"]`
        )
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git"]`
        )
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git".package(]`
        )
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", ]`
        )
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", .package(]`
        )
      ).toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", .exact(]`
        )
      ).toBeNull();
    });
    it('parses packages with invalid versions', () => {
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from]`
        )
      ).not.toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from.package(`
        )
      ).not.toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from:]`
        )
      ).not.toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from:.package(`
        )
      ).not.toBeNull();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3")]`
        )
      ).not.toBeNull();
    });
    it('parses package descriptions', () => {
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",from:"1.2.3")]`
        )
      ).toMatchSnapshot();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"...)]`
        )
      ).toMatchSnapshot();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"..."1.2.4")]`
        )
      ).toMatchSnapshot();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"..<"1.2.4")]`
        )
      ).toMatchSnapshot();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",..."1.2.3")]`
        )
      ).toMatchSnapshot();
      expect(
        extractPackageFile(
          `dependencies:[.package(url:"https://github.com/vapor/vapor.git",..<"1.2.3")]`
        )
      ).toMatchSnapshot();
    });
    it('parses multiple packages', () => {
      expect(extractPackageFile(pkgContent)).toMatchSnapshot();
    });
  });
  describe('updateDependency()', () => {
    it('updates successfully', () => {
      [
        [
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git",.exact("1.2.3")]',
          '1.2.4',
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git",.exact("1.2.4")]',
        ],
        [
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", from: "1.2.3")]',
          '1.2.4',
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", from: "1.2.4")]',
        ],
        [
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", "1.2.3"..."1.2.4")]',
          '"1.2.3"..."1.2.5"',
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", "1.2.3"..."1.2.5")]',
        ],
        [
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", "1.2.3"..<"1.2.4")]',
          '"1.2.3"..<"1.2.5"',
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", "1.2.3"..<"1.2.5")]',
        ],
        [
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", ..."1.2.4")]',
          '..."1.2.5"',
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", ..."1.2.5")]',
        ],
        [
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", ..<"1.2.4")]',
          '..<"1.2.5"',
          'dependencies:[.package(url:"https://github.com/vapor/vapor.git", ..<"1.2.5")]',
        ],
      ].forEach(([content, newValue, result]) => {
        const { deps } = extractPackageFile(content);
        const [dep] = deps;
        const upgrade = { ...dep, newValue };
        const updated = updateDependency({
          fileContent: content,
          upgrade,
        });
        expect(updated).toEqual(result);
      });
    });
    it('returns content if already updated', () => {
      const content =
        'dependencies:[.package(url:"https://github.com/vapor/vapor.git",.exact("1.2.3")]';
      const currentValue = '1.2.3';
      const newValue = '1.2.4';
      const { deps } = extractPackageFile(content);
      const [dep] = deps;
      const upgrade = { ...dep, newValue };
      const replaced = content.replace(currentValue, newValue);
      const updated = updateDependency({
        fileContent: replaced,
        upgrade,
      });
      expect(updated).toBe(replaced);
    });
    it('returns null if content is different', () => {
      const content =
        'dependencies:[.package(url:"https://github.com/vapor/vapor.git",.exact("1.2.3")]';
      const currentValue = '1.2.3';
      const newValue = '1.2.4';
      const { deps } = extractPackageFile(content);
      const [dep] = deps;
      const upgrade = { ...dep, newValue };
      const replaced = content.replace(currentValue, '1.2.5');
      expect(updateDependency({ fileContent: replaced, upgrade })).toBe(null);
    });
  });
});
