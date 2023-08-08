import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

describe('modules/manager/pub/extract', () => {
  describe('extractPackageFile', () => {
    const packageFile = 'pubspec.yaml';

    it('returns null if package does not contain any deps', () => {
      const content = codeBlock`
        environment:
          sdk: ^3.0.0
      `;
      const actual = extractPackageFile(content, packageFile);
      expect(actual).toBeNull();
    });

    it('returns null for invalid pubspec file', () => {
      const content = codeBlock`
        clarly: "invalid" "yaml"
      `;
      const actual = extractPackageFile(content, packageFile);
      expect(actual).toBeNull();
    });

    it('returns valid dependencies', () => {
      const dartDatasource = 'dart';
      const content = codeBlock`
        environment:
          sdk: ^3.0.0
          flutter: 2.0.0
        dependencies:
          meta: 'something'
          foo: 1.0.0
          bar:
            version: 1.1.0
          baz:
            non-sense: true
          qux: false
        dev_dependencies:
          test: ^0.1.0
          build:
            version: 0.0.1
      `;
      const actual = extractPackageFile(content, packageFile);
      expect(actual).toEqual({
        deps: [
          {
            currentValue: '1.0.0',
            depName: 'foo',
            depType: 'dependencies',
            datasource: dartDatasource,
          },
          {
            currentValue: '1.1.0',
            depName: 'bar',
            depType: 'dependencies',
            datasource: dartDatasource,
          },
          {
            currentValue: '^0.1.0',
            depName: 'test',
            depType: 'dev_dependencies',
            datasource: dartDatasource,
          },
          {
            currentValue: '0.0.1',
            depName: 'build',
            depType: 'dev_dependencies',
            datasource: dartDatasource,
          },
          {
            currentValue: '2.0.0',
            depName: 'flutter',
            datasource: 'flutter-version',
          },
        ],
      });
    });
  });
});
