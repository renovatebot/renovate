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

    it('extracts custom datasource configuration with forgejo-releases', () => {
      const content = `
# renovate: datasource=forgejo-releases depName=goern/forgejo-mcp registryUrl=https://codeberg.org
pkgname=forgejo-mcp
pkgver=1.0.0
source=("https://codeberg.org/goern/forgejo-mcp/releases/download/v\${pkgver}/forgejo-mcp-\${pkgver}.tar.gz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'goern/forgejo-mcp',
            currentValue: '1.0.0',
            datasource: 'forgejo-releases',
            registryUrls: ['https://codeberg.org'],
            managerData: {
              sourceUrl:
                'https://codeberg.org/goern/forgejo-mcp/releases/download/v${pkgver}/forgejo-mcp-${pkgver}.tar.gz',
              checksums: {
                sha256:
                  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              },
              pkgver: '1.0.0',
            },
          },
        ],
      });
    });

    it('extracts custom datasource configuration with cpan', () => {
      const content = `
# renovate: datasource=cpan depName=Mojolicious
pkgname=perl-mojolicious
pkgver=9.36
source=("https://cpan.metacpan.org/authors/id/S/SR/SRI/Mojolicious-\${pkgver}.tar.gz")
sha256sums=('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
`;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'Mojolicious',
            currentValue: '9.36',
            datasource: 'cpan',
            managerData: {
              sourceUrl:
                'https://cpan.metacpan.org/authors/id/S/SR/SRI/Mojolicious-${pkgver}.tar.gz',
              checksums: {
                sha256:
                  'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
              },
              pkgver: '9.36',
            },
          },
        ],
      });
    });

    it('extracts custom datasource with packageName', () => {
      const content = `
# renovate: datasource=pypi packageName=Django depName=python-django
pkgname=python-django
pkgver=4.2.7
source=("https://pypi.io/packages/source/D/Django/Django-\${pkgver}.tar.gz")
sha256sums=('8e0f1c2c2786b5c0e39fe1afce24c926040fad47c8ea8ad30aaf1188df29fc41')
`;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'python-django',
            currentValue: '4.2.7',
            datasource: 'pypi',
            packageName: 'Django',
            managerData: {
              sourceUrl:
                'https://pypi.io/packages/source/D/Django/Django-${pkgver}.tar.gz',
              checksums: {
                sha256:
                  '8e0f1c2c2786b5c0e39fe1afce24c926040fad47c8ea8ad30aaf1188df29fc41',
              },
              pkgver: '4.2.7',
            },
          },
        ],
      });
    });

    it('returns null if custom datasource specified without depName', () => {
      const content = `
# renovate: datasource=cpan
pkgver=1.0.0
source=("https://cpan.metacpan.org/authors/id/S/SR/SRI/Mojolicious-1.0.0.tar.gz")
`;
      expect(extractPackageFile(content)).toBeNull();
    });

    it('extracts custom datasource with custom versioning', () => {
      const content = `
# renovate: datasource=npm depName=typescript versioning=npm
pkgname=typescript
pkgver=5.3.3
source=("https://registry.npmjs.org/typescript/-/typescript-\${pkgver}.tgz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result).toEqual({
        deps: [
          {
            depName: 'typescript',
            currentValue: '5.3.3',
            datasource: 'npm',
            versioning: 'npm',
            managerData: {
              sourceUrl:
                'https://registry.npmjs.org/typescript/-/typescript-${pkgver}.tgz',
              checksums: {
                sha256:
                  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              },
              pkgver: '5.3.3',
            },
          },
        ],
      });
    });
  });
});
