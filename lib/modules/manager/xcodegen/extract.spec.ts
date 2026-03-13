import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures.ts';
import { extractPackageFile } from './index.ts';

const projectYml = Fixtures.get('project.yml');

describe('modules/manager/xcodegen/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty content', () => {
      expect(extractPackageFile('', 'project.yml')).toBeNull();
    });

    it('returns null for invalid YAML', () => {
      expect(extractPackageFile(':::', 'project.yml')).toBeNull();
    });

    it('returns null for YAML without packages', () => {
      const content = codeBlock`
        name: MyProject
        targets:
          App:
            type: application
      `;
      expect(extractPackageFile(content, 'project.yml')).toBeNull();
    });

    it('returns null for empty packages', () => {
      const content = codeBlock`
        name: MyProject
        packages: {}
      `;
      expect(extractPackageFile(content, 'project.yml')).toBeNull();
    });

    it('extracts dependencies from full project.yml fixture', () => {
      const result = extractPackageFile(projectYml, 'project.yml');
      expect(result).not.toBeNull();
      expect(result!.deps).toHaveLength(13);
    });

    it('extracts remote package with url and from', () => {
      const content = codeBlock`
        packages:
          Yams:
            url: https://github.com/jpsim/Yams
            from: 2.0.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'Yams',
            packageName: 'jpsim/Yams',
            datasource: 'github-tags',
            currentValue: '2.0.0',
            depType: 'from',
          },
        ],
      });
    });

    it('extracts remote package with github shorthand', () => {
      const content = codeBlock`
        packages:
          Ink:
            github: JohnSundell/Ink
            from: 0.5.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'Ink',
            packageName: 'Ink',
            datasource: 'github-tags',
            currentValue: '0.5.0',
            depType: 'from',
          },
        ],
      });
    });

    it('extracts remote package with majorVersion', () => {
      const content = codeBlock`
        packages:
          Alamofire:
            url: https://github.com/Alamofire/Alamofire
            majorVersion: 5.0.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'Alamofire',
            packageName: 'Alamofire/Alamofire',
            datasource: 'github-tags',
            currentValue: '5.0.0',
            depType: 'majorVersion',
          },
        ],
      });
    });

    it('extracts remote package with minorVersion', () => {
      const content = codeBlock`
        packages:
          SnapKit:
            url: https://github.com/SnapKit/SnapKit
            minorVersion: 5.6.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'SnapKit',
            packageName: 'SnapKit/SnapKit',
            datasource: 'github-tags',
            currentValue: '5.6.0',
            depType: 'minorVersion',
          },
        ],
      });
    });

    it('extracts remote package with exactVersion', () => {
      const content = codeBlock`
        packages:
          SwiftLint:
            url: https://github.com/realm/SwiftLint
            exactVersion: 0.50.3
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'SwiftLint',
            packageName: 'realm/SwiftLint',
            datasource: 'github-tags',
            currentValue: '0.50.3',
            depType: 'exactVersion',
          },
        ],
      });
    });

    it('extracts remote package with version', () => {
      const content = codeBlock`
        packages:
          Moya:
            url: https://github.com/Moya/Moya
            version: 15.0.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'Moya',
            packageName: 'Moya/Moya',
            datasource: 'github-tags',
            currentValue: '15.0.0',
            depType: 'version',
          },
        ],
      });
    });

    it('skips local packages with path', () => {
      const content = codeBlock`
        packages:
          RxClient:
            path: ../RxClient
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'RxClient',
            skipReason: 'path-dependency',
          },
        ],
      });
    });

    it('skips packages with branch reference', () => {
      const content = codeBlock`
        packages:
          SwiftPM:
            url: https://github.com/apple/swift-package-manager
            branch: swift-5.0-branch
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'SwiftPM',
            skipReason: 'unversioned-reference',
            currentValue: 'swift-5.0-branch',
          },
        ],
      });
    });

    it('skips packages with revision reference', () => {
      const content = codeBlock`
        packages:
          SomePkg:
            url: https://github.com/example/some-pkg
            revision: abc123
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'SomePkg',
            skipReason: 'unversioned-reference',
            currentValue: 'abc123',
          },
        ],
      });
    });

    it('skips packages with minVersion/maxVersion range', () => {
      const content = codeBlock`
        packages:
          SomePkg:
            url: https://github.com/example/some-pkg
            minVersion: 1.0.0
            maxVersion: 2.0.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'SomePkg',
            skipReason: 'unsupported-version',
            currentValue: '1.0.0 - 2.0.0',
          },
        ],
      });
    });

    it('uses gitlab-tags datasource for GitLab URLs', () => {
      const content = codeBlock`
        packages:
          GitLabPkg:
            url: https://gitlab.com/some-group/some-project
            from: 1.0.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'GitLabPkg',
            packageName: 'some-group/some-project',
            datasource: 'gitlab-tags',
            currentValue: '1.0.0',
            depType: 'from',
          },
        ],
      });
    });

    it('uses git-tags datasource for non-GitHub/GitLab URLs', () => {
      const content = codeBlock`
        packages:
          GenericPkg:
            url: https://example.com/some/repo.git
            from: 3.0.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'GenericPkg',
            packageName: 'https://example.com/some/repo.git',
            datasource: 'git-tags',
            currentValue: '3.0.0',
            depType: 'from',
          },
        ],
      });
    });

    it('skips packages without url or github', () => {
      const content = codeBlock`
        packages:
          BadPkg:
            from: 1.0.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'BadPkg',
            skipReason: 'invalid-url',
          },
        ],
      });
    });

    it('skips packages without version specifier', () => {
      const content = codeBlock`
        packages:
          NoPkg:
            url: https://github.com/example/no-version
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'NoPkg',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('extracts multiple packages correctly', () => {
      const content = codeBlock`
        packages:
          Yams:
            url: https://github.com/jpsim/Yams
            from: 2.0.0
          Ink:
            github: JohnSundell/Ink
            from: 0.5.0
          RxClient:
            path: ../RxClient
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'Yams',
            packageName: 'jpsim/Yams',
            datasource: 'github-tags',
            currentValue: '2.0.0',
            depType: 'from',
          },
          {
            depName: 'Ink',
            packageName: 'Ink',
            datasource: 'github-tags',
            currentValue: '0.5.0',
            depType: 'from',
          },
          {
            depName: 'RxClient',
            skipReason: 'path-dependency',
          },
        ],
      });
    });

    it('handles github URL with .git suffix', () => {
      const content = codeBlock`
        packages:
          Yams:
            url: https://github.com/jpsim/Yams.git
            from: 2.0.0
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'Yams',
            packageName: 'jpsim/Yams',
            datasource: 'github-tags',
            currentValue: '2.0.0',
            depType: 'from',
          },
        ],
      });
    });

    it('handles numeric version values from YAML parsing', () => {
      const content = codeBlock`
        packages:
          SomePkg:
            url: https://github.com/example/some-pkg
            from: 5
      `;
      const result = extractPackageFile(content, 'project.yml');
      expect(result).toEqual({
        deps: [
          {
            depName: 'SomePkg',
            packageName: 'example/some-pkg',
            datasource: 'github-tags',
            currentValue: '5',
            depType: 'from',
          },
        ],
      });
    });
  });
});
