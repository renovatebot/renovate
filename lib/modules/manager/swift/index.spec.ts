import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { fs } from '~test/util.ts';
import { SwiftPackageRegistryDatasource } from '../../datasource/swift-package-registry/index.ts';
import { extractAllPackageFiles, extractPackageFile } from './index.ts';

vi.mock('../../../util/fs/index.ts');

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
      // Mirror the url-form malformed-input coverage for the SE-0292 id form.
      expect(extractPackageFile(`dependencies:[.package(id],`)).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(id.package(]`),
      ).toBeNull();
      expect(
        extractPackageFile(`dependencies:[.package(id:.package(`),
      ).toBeNull();
      expect(extractPackageFile(`dependencies:[.package(id:]`)).toBeNull();
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
      expect(extractPackageFile(Fixtures.get(`SamplePackage.swift`))).toEqual({
        deps: [
          {
            currentValue: '"master"\n        ',
            datasource: 'github-tags',
            depName: '0x7fs/CountedSet',
          },
          {
            currentValue: 'from: "1.2.3"',
            datasource: 'github-tags',
            depName: 'foo/bar',
          },
          {
            currentValue: '0.1.0',
            datasource: 'github-tags',
            depName: 'avito-tech/GraphiteClient',
          },
          {
            currentValue: '1.0.16',
            datasource: 'github-tags',
            depName: 'IBM-Swift/BlueSignals',
          },
          {
            currentValue: '1.2.1',
            datasource: 'github-tags',
            depName: 'apple/swift-argument-parser',
          },
          {
            currentValue: '"UpdateSocket"\n        ',
            datasource: 'github-tags',
            depName: 'beefon/Shout',
          },
          {
            currentValue: '3.0.6',
            datasource: 'github-tags',
            depName: 'daltoniam/Starscream',
          },
          {
            currentValue: '1.4.6',
            datasource: 'github-tags',
            depName: 'httpswift/swifter',
          },
          {
            currentValue: 'from : "0.9.6"',
            datasource: 'github-tags',
            depName: 'weichsel/ZIPFoundation',
          },
          {
            currentValue: '"swift-5.0-branch"\n    ',
            datasource: 'github-tags',
            depName: 'apple/swift-package-manager',
          },
        ],
      });
    });
  });

  describe('extractAllPackageFiles()', () => {
    const packageSwiftWithIdForm = codeBlock`
      // swift-tools-version:5.7
      let package = Package(
        name: "Demo",
        dependencies: [
          .package(id: "acme.somelib", from: "1.0.0"),
        ]
      )
    `;

    const registriesJson = JSON.stringify({
      registries: {
        '[default]': { url: 'https://registry.example.com' },
      },
      version: 1,
    });

    it('returns null when no Package.swift files supplied', async () => {
      expect(await extractAllPackageFiles({}, [])).toBeNull();
    });

    it('skips unreadable Package.swift files', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      expect(await extractAllPackageFiles({}, ['Package.swift'])).toBeNull();
    });

    it('skips Package.swift files that have content but yield no deps', async () => {
      fs.readLocalFile.mockResolvedValueOnce('// no deps here');
      expect(await extractAllPackageFiles({}, ['Package.swift'])).toBeNull();
    });

    it('attaches discovered registry URLs to id-form deps', async () => {
      fs.readLocalFile.mockImplementation((path: string) => {
        if (path === 'Package.swift') {
          return Promise.resolve(packageSwiftWithIdForm);
        }
        if (path === '.swiftpm/configuration/registries.json') {
          return Promise.resolve(registriesJson);
        }
        return Promise.resolve(null);
      });

      const result = await extractAllPackageFiles({}, ['Package.swift']);
      expect(result).toEqual([
        {
          packageFile: 'Package.swift',
          deps: [
            {
              datasource: SwiftPackageRegistryDatasource.id,
              depName: 'acme.somelib',
              packageName: 'acme.somelib',
              currentValue: 'from: "1.0.0"',
              registryUrls: ['https://registry.example.com'],
            },
          ],
        },
      ]);
    });

    it('skips registries.json read when there are no id-form deps', async () => {
      fs.readLocalFile.mockImplementation((path: string) => {
        if (path === 'Package.swift') {
          return Promise.resolve(codeBlock`
            let package = Package(
              dependencies: [
                .package(url: "https://github.com/vapor/vapor.git", from: "4.0.0"),
              ]
            )
          `);
        }
        return Promise.resolve(null);
      });

      const result = await extractAllPackageFiles({}, ['Package.swift']);
      expect(result).toEqual([
        {
          packageFile: 'Package.swift',
          deps: [
            {
              datasource: 'github-tags',
              depName: 'vapor/vapor',
              currentValue: 'from: "4.0.0"',
            },
          ],
        },
      ]);
      // Only Package.swift is read; registries.json discovery is skipped.
      expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    });

    it('returns id-form deps with no registryUrls when registries.json is absent', async () => {
      fs.readLocalFile.mockImplementation((path: string) => {
        if (path === 'Package.swift') {
          return Promise.resolve(packageSwiftWithIdForm);
        }
        return Promise.resolve(null);
      });

      const result = await extractAllPackageFiles({}, ['Package.swift']);
      expect(result?.[0].deps[0]).toEqual({
        datasource: SwiftPackageRegistryDatasource.id,
        depName: 'acme.somelib',
        packageName: 'acme.somelib',
        currentValue: 'from: "1.0.0"',
      });
    });
  });
});
