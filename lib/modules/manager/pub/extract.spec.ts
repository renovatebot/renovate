import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

describe('modules/manager/pub/extract', () => {
  describe('extractPackageFile', () => {
    const packageFile = 'pubspec.yaml';

    it('returns null for invalid pubspec file', () => {
      const content = codeBlock`
        clarly: "invalid" "yaml"
      `;
      const actual = extractPackageFile(content, packageFile);
      expect(actual).toBeNull();
    });

    it('returns dart sdk only', () => {
      const content = codeBlock`
        environment:
          sdk: ^3.0.0
      `;
      const actual = extractPackageFile(content, packageFile);
      expect(actual).toEqual({
        deps: [
          {
            currentValue: '^3.0.0',
            depName: 'dart',
            datasource: 'dart-version',
          },
        ],
      });
    });

    it('returns valid dependencies', () => {
      const dependenciesDepType = 'dependencies';
      const devDependenciesDepType = 'dev_dependencies';
      const dartDatasource = 'dart';
      const gitRefDatasource = 'git-refs';
      const skipReason = undefined;
      const content = codeBlock`
        environment:
          sdk: ^3.0.0
          flutter: 2.0.0
        dependencies:
          meta: 'something'
          foo: 1.0.0
          transmogrify:
            hosted:
              name: transmogrify
              url: https://some-package-server.com
            version: ^1.4.0
          bar:
            hosted: 'some-url'
            version: 1.1.0
          baz:
            non-sense: true
          qux: false
          path_dep:
            path: path1
          git_package:
            git:
              url: https://github.com/some-url/some-package
          git_package_ref:
            git:
              url: https://github.com/some-url/some-package-ref
              ref: v1.0.0
          git_package_version:
            git:
              url: https://github.com/some-url/some-package-version
            version: ^1.1.0
          git_package_version_git_url:
            git: https://github.com/some-url/some-package-version-url
            version: ^1.1.0
        dev_dependencies:
          test: ^0.1.0
          build:
            version: 0.0.1
          flutter_test:
            sdk: flutter
          path_dev_dep:
            path: path2
      `;
      const actual = extractPackageFile(content, packageFile);
      expect(actual).toEqual({
        deps: [
          {
            currentValue: '1.0.0',
            depName: 'foo',
            depType: dependenciesDepType,
            datasource: dartDatasource,
            skipReason,
          },
          {
            currentValue: '^1.4.0',
            depName: 'transmogrify',
            depType: dependenciesDepType,
            datasource: dartDatasource,
            registryUrls: ['https://some-package-server.com'],
          },
          {
            currentValue: '1.1.0',
            depName: 'bar',
            depType: dependenciesDepType,
            datasource: dartDatasource,
            skipReason,
            registryUrls: ['some-url'],
          },
          {
            currentValue: '',
            depName: 'baz',
            depType: dependenciesDepType,
            datasource: dartDatasource,
            skipReason,
          },
          {
            currentValue: '',
            depName: 'path_dep',
            depType: dependenciesDepType,
            datasource: dartDatasource,
            skipReason: 'path-dependency',
          },
          {
            currentValue: '',
            depName: 'git_package',
            packageName: 'https://github.com/some-url/some-package',
            depType: dependenciesDepType,
            datasource: gitRefDatasource,
            skipReason: 'unspecified-version',
          },
          {
            currentValue: 'v1.0.0',
            depName: 'git_package_ref',
            packageName: 'https://github.com/some-url/some-package-ref',
            depType: dependenciesDepType,
            datasource: gitRefDatasource,
            skipReason,
          },
          {
            currentValue: '^1.1.0',
            depName: 'git_package_version',
            packageName: 'https://github.com/some-url/some-package-version',
            depType: dependenciesDepType,
            datasource: gitRefDatasource,
            skipReason,
          },
          {
            currentValue: '^1.1.0',
            depName: 'git_package_version_git_url',
            packageName: 'https://github.com/some-url/some-package-version-url',
            depType: dependenciesDepType,
            datasource: gitRefDatasource,
            skipReason,
          },
          {
            currentValue: '^0.1.0',
            depName: 'test',
            depType: devDependenciesDepType,
            datasource: dartDatasource,
            skipReason,
          },
          {
            currentValue: '0.0.1',
            depName: 'build',
            depType: devDependenciesDepType,
            datasource: dartDatasource,
            skipReason,
          },
          {
            currentValue: '',
            depName: 'path_dev_dep',
            depType: devDependenciesDepType,
            datasource: dartDatasource,
            skipReason: 'path-dependency',
          },
          {
            currentValue: '^3.0.0',
            depName: 'dart',
            datasource: 'dart-version',
            skipReason,
          },
          {
            currentValue: '2.0.0',
            depName: 'flutter',
            datasource: 'flutter-version',
            skipReason,
          },
        ],
      });
    });
  });
});
