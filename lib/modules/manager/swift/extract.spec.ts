import { extractPackageFile } from './extract';
import { Fixtures } from '~test/fixtures';

describe('modules/manager/swift/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty content', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('returns null for content without dependencies', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          products: [
            .library(
              name: "MyLibrary",
              targets: ["MyLibrary"]
            )
          ],
          targets: [
            .target(
              name: "MyLibrary"
            )
          ]
        )
      `;
      expect(extractPackageFile(content)).toBeNull();
    });

    it('extracts GitHub dependencies with github-tags datasource', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://github.com/example/repo", from: "1.0.0")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            datasource: 'github-tags',
            depName: 'example/repo',
            currentValue: 'from: "1.0.0"',
          },
        ],
      });
    });

    it('extracts GitLab dependencies with gitlab-tags datasource', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://gitlab.com/example/repo", from: "2.0.0")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            datasource: 'gitlab-tags',
            depName: 'example/repo',
            currentValue: 'from: "2.0.0"',
          },
        ],
      });
    });

    it('extracts self-hosted GitHub dependencies with registryUrls', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://github.example.com/org/repo", from: "1.0.0")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            datasource: 'github-tags',
            depName: 'org/repo',
            currentValue: 'from: "1.0.0"',
            registryUrls: ['https://github.example.com'],
          },
        ],
      });
    });

    it('extracts self-hosted GitLab dependencies with registryUrls', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://gitlab.mycompany.com/group/project.git", from: "2.5.0")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            datasource: 'gitlab-tags',
            depName: 'group/project',
            currentValue: 'from: "2.5.0"',
            registryUrls: ['https://gitlab.mycompany.com'],
          },
        ],
      });
    });

    it('extracts other dependencies with git-tags datasource', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://example.com/repo.git", from: "3.0.0")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            datasource: 'git-tags',
            depName: 'https://example.com/repo.git',
            currentValue: 'from: "3.0.0"',
          },
        ],
      });
    });

    it('extracts exact version dependencies', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://github.com/example/repo", .exact("1.2.3"))
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            datasource: 'github-tags',
            depName: 'example/repo',
            currentValue: '1.2.3',
          },
        ],
      });
    });

    it('extracts exact version with label syntax', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://github.com/example/repo", exact: "1.2.1")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            datasource: 'github-tags',
            depName: 'example/repo',
            currentValue: '1.2.1',
          },
        ],
      });
    });

    it('extracts range version dependencies', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://github.com/example/repo", "1.0.0"..."2.0.0")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            datasource: 'github-tags',
            depName: 'example/repo',
            currentValue: '"1.0.0"..."2.0.0"',
          },
        ],
      });
    });

    it('extracts dependencies from sample package file', () => {
      const result = extractPackageFile(Fixtures.get('SamplePackage.swift'));

      expect(result?.deps).toHaveLength(9);

      const githubDeps =
        result?.deps.filter((dep) => dep.datasource === 'github-tags') ?? [];
      expect(githubDeps).toHaveLength(9);

      expect(result?.deps).toContainEqual({
        datasource: 'github-tags',
        depName: '0x7fs/CountedSet',
        currentValue: '"master"\n        ',
      });

      expect(result?.deps).toContainEqual({
        datasource: 'github-tags',
        depName: 'avito-tech/GraphiteClient',
        currentValue: '0.1.0',
      });

      expect(result?.deps).toContainEqual({
        datasource: 'github-tags',
        depName: 'apple/swift-argument-parser',
        currentValue: '1.2.1',
      });

      // Check that ZIPFoundation was extracted from the multi-line declaration
      expect(result?.deps).toContainEqual({
        datasource: 'github-tags',
        depName: 'weichsel/ZIPFoundation',
        currentValue: 'from : "0.9.6"',
      });
    });

    it('handles malformed URLs gracefully', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "not-a-valid-url", from: "1.0.0")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('handles dependencies without version', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://github.com/example/repo")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('extracts multiple dependencies with different datasources', () => {
      const content = `
        let package = Package(
          name: "MyPackage",
          dependencies: [
            .package(url: "https://github.com/example/github-repo", from: "1.0.0"),
            .package(url: "https://gitlab.com/example/gitlab-repo", from: "2.0.0"),
            .package(url: "https://example.com/other-repo.git", from: "3.0.0")
          ]
        )
      `;
      const result = extractPackageFile(content);
      expect(result?.deps).toHaveLength(3);
      expect(result?.deps[0].datasource).toBe('github-tags');
      expect(result?.deps[1].datasource).toBe('gitlab-tags');
      expect(result?.deps[2].datasource).toBe('git-tags');
    });
  });
});
