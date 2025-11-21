import { extractPackageFile } from './extract';

describe('modules/manager/pkgbuild/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty content', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('returns null for invalid PKGBUILD', () => {
      expect(extractPackageFile('invalid content')).toBeNull();
    });

    it('returns null when no pkgver found', () => {
      expect(
        extractPackageFile(
          'source=("https://github.com/test/test/archive/v1.0.0.tar.gz")',
        ),
      ).toBeNull();
    });

    it('returns null when no source found', () => {
      expect(extractPackageFile('pkgver=1.0.0')).toBeNull();
    });

    it('extracts dependency from simple PKGBUILD', () => {
      const content = `
pkgname=example-package
pkgver=1.2.3
pkgrel=1
source=("https://github.com/example/example/archive/v\${pkgver}.tar.gz")
sha256sums=('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
`;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'example/example',
            currentValue: 'v1.2.3',
            datasource: 'github-tags',
            managerData: {
              sourceUrl:
                'https://github.com/example/example/archive/v${pkgver}.tar.gz',
              checksums: {
                sha256:
                  'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              },
              pkgver: '1.2.3',
            },
          },
        ],
      });
    });

    it('extracts dependency with multiple checksums', () => {
      const content = `
pkgname=test-multi
pkgver=2.0.0
source=("https://github.com/test/multi/releases/download/v\${pkgver}/multi-\${pkgver}.tar.gz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
sha512sums=('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321')
`;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'test/multi',
            currentValue: 'v2.0.0',
            datasource: 'github-tags',
            managerData: {
              sourceUrl:
                'https://github.com/test/multi/releases/download/v${pkgver}/multi-${pkgver}.tar.gz',
              checksums: {
                sha256:
                  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                sha512:
                  'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
              },
              pkgver: '2.0.0',
            },
          },
        ],
      });
    });

    it('extracts dependency without checksums', () => {
      const content = `
pkgname=test-nochecksum
pkgver=1.0.0
source=("https://github.com/test/nochecksum/archive/refs/tags/v\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'test/nochecksum',
            currentValue: 'v1.0.0',
            datasource: 'github-tags',
            managerData: {
              sourceUrl:
                'https://github.com/test/nochecksum/archive/refs/tags/v${pkgver}.tar.gz',
              checksums: {},
              pkgver: '1.0.0',
            },
          },
        ],
      });
    });

    it('extracts all checksum types', () => {
      const content = `
pkgname=test-allchecksums
pkgver=3.0.0
source=("https://github.com/test/allchecksums/archive/v\${pkgver}.tar.gz")
sha256sums=('1111111111111111111111111111111111111111111111111111111111111111')
sha512sums=('22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222')
b2sums=('33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333')
md5sums=('44444444444444444444444444444444')
`;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'test/allchecksums',
            currentValue: 'v3.0.0',
            datasource: 'github-tags',
            managerData: {
              sourceUrl:
                'https://github.com/test/allchecksums/archive/v${pkgver}.tar.gz',
              checksums: {
                sha256:
                  '1111111111111111111111111111111111111111111111111111111111111111',
                sha512:
                  '22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222',
                b2: '33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333',
                md5: '44444444444444444444444444444444',
              },
              pkgver: '3.0.0',
            },
          },
        ],
      });
    });

    it('handles refs/tags format', () => {
      const content = `
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/refs/tags/v\${pkgver}.tar.gz")
sha256sums=('abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
      });
    });

    it('handles github archive url without refs/tags', () => {
      const content = `
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v1.0.0.tar.gz")
sha256sums=('abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
      });
    });

    it('returns null for non-GitHub/GitLab sources', () => {
      const content = `
pkgver=1.0.0
source=("https://example.com/package-1.0.0.tar.gz")
`;
      expect(extractPackageFile(content)).toBeNull();
    });

    it('extracts dependency from GitLab source', () => {
      const content = `
pkgname=example-gitlab-package
pkgver=1.2.3
source=("https://gitlab.com/test-owner/test-repo/-/archive/v\${pkgver}/test-repo-v\${pkgver}.tar.gz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'test-owner/test-repo',
            currentValue: 'v1.2.3',
            datasource: 'gitlab-tags',
            managerData: {
              sourceUrl:
                'https://gitlab.com/test-owner/test-repo/-/archive/v${pkgver}/test-repo-v${pkgver}.tar.gz',
              checksums: {
                sha256:
                  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              },
              pkgver: '1.2.3',
            },
          },
        ],
      });
    });

    it('handles self-hosted GitLab instances', () => {
      const content = `
pkgver=2.5.0
source=("https://gitlab.example.com/myorg/myproject/-/archive/v\${pkgver}/myproject-v\${pkgver}.tar.gz")
sha256sums=('abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'myorg/myproject',
        currentValue: 'v2.5.0',
        datasource: 'gitlab-tags',
      });
    });
  });
});
