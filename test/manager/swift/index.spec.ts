import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/swift/extract';
import { updateDependency } from '../../../lib/manager/swift/update';

const pkgContent = readFileSync(
  resolve(__dirname, `./_fixtures/SamplePackage.swift`),
  'utf8'
);

describe('lib/manager/swift', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty content', () => {
      expect(extractPackageFile(null)).toBeNull();
      expect(extractPackageFile({ fileContent: `` })).toBeNull();
      expect(extractPackageFile({ fileContent: `dependencies:[]` })).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:["foobar"]` })
      ).toBeNull();
    });
    it('returns null for invalid content', () => {
      expect(extractPackageFile({ fileContent: `dependen` })).toBeNull();
      expect(extractPackageFile({ fileContent: `dependencies!: ` })).toBeNull();
      expect(extractPackageFile({ fileContent: `dependencies :` })).toBeNull();
      expect(extractPackageFile({ fileContent: `dependencies...` })).toBeNull();
      expect(extractPackageFile({ fileContent: `dependencies:!` })).toBeNull();
      expect(extractPackageFile({ fileContent: `dependencies:[` })).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[...` })
      ).toBeNull();
      expect(extractPackageFile({ fileContent: `dependencies:[]` })).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package.package(` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package(asdf` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package]` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package(]` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package(.package(` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package(` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package(]` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package(url],` })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url.package(]`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:.package(`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package(url:]` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package(url:"fo` })
      ).toBeNull();
      expect(
        extractPackageFile({ fileContent: `dependencies:[.package(url:"fo]` })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://example.com/something.git"]`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git"]`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git".package(]`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git", ]`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git", .package(]`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git", .exact(]`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from]`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from.package(`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from:]`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git", from:.package(`,
        })
      ).toBeNull();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3")]`,
        })
      ).toBeNull();
    });
    it('parses package descriptions', () => {
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git",from:"1.2.3")]`,
        })
      ).toMatchSnapshot();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"...)]`,
        })
      ).toMatchSnapshot();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"..."1.2.4")]`,
        })
      ).toMatchSnapshot();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git","1.2.3"..<"1.2.4")]`,
        })
      ).toMatchSnapshot();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git",..."1.2.3")]`,
        })
      ).toMatchSnapshot();
      expect(
        extractPackageFile({
          fileContent: `dependencies:[.package(url:"https://github.com/vapor/vapor.git",..<"1.2.3")]`,
        })
      ).toMatchSnapshot();
    });
    it('parses multiple packages', () => {
      expect(extractPackageFile({ fileContent: pkgContent })).toMatchSnapshot();
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
      ].forEach(([fileContent, newValue, result]) => {
        const { deps } = extractPackageFile({ fileContent });
        const [dep] = deps;
        const upgrade = { ...dep, newValue };
        const updated = updateDependency(fileContent, upgrade);
        expect(updated).toEqual(result);
      });
    });
    it('returns content if already updated', () => {
      const fileContent =
        'dependencies:[.package(url:"https://github.com/vapor/vapor.git",.exact("1.2.3")]';
      const currentValue = '1.2.3';
      const newValue = '1.2.4';
      const { deps } = extractPackageFile({ fileContent });
      const [dep] = deps;
      const upgrade = { ...dep, newValue };
      const replaced = fileContent.replace(currentValue, newValue);
      const updated = updateDependency(replaced, upgrade);
      expect(updated).toBe(replaced);
    });
    it('returns null if content is different', () => {
      const fileContent =
        'dependencies:[.package(url:"https://github.com/vapor/vapor.git",.exact("1.2.3")]';
      const currentValue = '1.2.3';
      const newValue = '1.2.4';
      const { deps } = extractPackageFile({ fileContent });
      const [dep] = deps;
      const upgrade = { ...dep, newValue };
      const replaced = fileContent.replace(currentValue, '1.2.5');
      expect(updateDependency(replaced, upgrade)).toBe(null);
    });
  });
});
