import { extractPackageFile } from './extract.ts';

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
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'example/example',
            currentValue: 'v1.2.3',
            datasource: 'github-tags',
            managerData: {
              sourceUrl:
                'https://github.com/example/example/archive/v1.2.3.tar.gz',
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
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'test/multi',
            currentValue: 'v2.0.0',
            datasource: 'github-tags',
            managerData: {
              sourceUrl:
                'https://github.com/test/multi/releases/download/v2.0.0/multi-2.0.0.tar.gz',
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
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'test/nochecksum',
            currentValue: 'v1.0.0',
            datasource: 'github-tags',
            managerData: {
              sourceUrl:
                'https://github.com/test/nochecksum/archive/refs/tags/v1.0.0.tar.gz',
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
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'test/allchecksums',
            currentValue: 'v3.0.0',
            datasource: 'github-tags',
            managerData: {
              sourceUrl:
                'https://github.com/test/allchecksums/archive/v3.0.0.tar.gz',
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

    it('extracts architecture-specific checksums', () => {
      const content = `
pkgname=test-arch
pkgver=1.0.0
arch=('x86_64' 'aarch64')
source=("https://github.com/test/arch/archive/v\${pkgver}.tar.gz")
sha256sums_x86_64=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
sha256sums_aarch64=('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'test/arch',
            currentValue: 'v1.0.0',
            datasource: 'github-tags',
            managerData: {
              sourceUrl: 'https://github.com/test/arch/archive/v1.0.0.tar.gz',
              checksums: {
                sha256: [
                  {
                    value:
                      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    suffix: '_x86_64',
                  },
                  {
                    value:
                      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    suffix: '_aarch64',
                  },
                ],
              },
              pkgver: '1.0.0',
            },
          },
        ],
      });
    });

    it('handles mixed architecture-specific and regular checksums', () => {
      const content = `
pkgname=test-mixed
pkgver=2.5.0
source=("https://github.com/test/mixed/archive/v\${pkgver}.tar.gz")
sha256sums=('1111111111111111111111111111111111111111111111111111111111111111')
sha512sums_x86_64=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1')
sha512sums_aarch64=('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'test/mixed',
            currentValue: 'v2.5.0',
            datasource: 'github-tags',
            managerData: {
              sourceUrl: 'https://github.com/test/mixed/archive/v2.5.0.tar.gz',
              checksums: {
                sha256:
                  '1111111111111111111111111111111111111111111111111111111111111111',
                sha512: [
                  {
                    value:
                      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
                    suffix: '_x86_64',
                  },
                  {
                    value:
                      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    suffix: '_aarch64',
                  },
                ],
              },
              pkgver: '2.5.0',
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

    it('uses filename fallback for non-GitHub/GitLab sources without pkgname', () => {
      const content = `
pkgver=1.0.0
source=("https://example.com/package-1.0.0.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'aur/package',
            currentValue: '1.0.0',
            datasource: 'repology',
            managerData: {
              sourceUrl: 'https://example.com/package-1.0.0.tar.gz',
              checksums: {},
              pkgver: '1.0.0',
            },
          },
        ],
      });
    });

    it('extracts dependency from PyPI source', () => {
      const content = `
pkgname=python-requests
pkgver=2.31.0
source=("https://files.pythonhosted.org/packages/source/r/requests/requests-\${pkgver}.tar.gz")
sha256sums=('942c5a758f98d5e4783a997e9c5b0e7e9c2d6f2e6d4e3b2c1a3f6e7d8a9b0c11')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'requests',
            currentValue: '2.31.0',
            datasource: 'pypi',
            managerData: {
              sourceUrl:
                'https://files.pythonhosted.org/packages/source/r/requests/requests-2.31.0.tar.gz',
              checksums: {
                sha256:
                  '942c5a758f98d5e4783a997e9c5b0e7e9c2d6f2e6d4e3b2c1a3f6e7d8a9b0c11',
              },
              pkgver: '2.31.0',
            },
          },
        ],
      });
    });

    it('extracts dependency from npm registry source', () => {
      const content = `
pkgname=nodejs-typescript
pkgver=5.3.2
source=("https://registry.npmjs.org/typescript/-/typescript-\${pkgver}.tgz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'typescript',
            currentValue: '5.3.2',
            datasource: 'npm',
            managerData: {
              sourceUrl:
                'https://registry.npmjs.org/typescript/-/typescript-5.3.2.tgz',
              checksums: {
                sha256:
                  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              },
              pkgver: '5.3.2',
            },
          },
        ],
      });
    });

    it('extracts dependency from scoped npm package', () => {
      const content = `
pkgname=nodejs-angular-core
pkgver=17.0.5
source=("https://registry.npmjs.org/@angular/core/-/core-\${pkgver}.tgz")
sha256sums=('abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: '@angular/core',
            currentValue: '17.0.5',
            datasource: 'npm',
            managerData: {
              sourceUrl:
                'https://registry.npmjs.org/@angular/core/-/core-17.0.5.tgz',
              checksums: {
                sha256:
                  'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
              },
              pkgver: '17.0.5',
            },
          },
        ],
      });
    });

    it('extracts dependency from CPAN source', () => {
      const content = `
pkgname=perl-module-build
pkgver=0.4234
source=("https://cpan.metacpan.org/authors/id/L/LE/LEONT/Module-Build-\${pkgver}.tar.gz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'Module::Build',
            currentValue: '0.4234',
            datasource: 'cpan',
            managerData: {
              sourceUrl:
                'https://cpan.metacpan.org/authors/id/L/LE/LEONT/Module-Build-0.4234.tar.gz',
              checksums: {
                sha256:
                  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              },
              pkgver: '0.4234',
            },
          },
        ],
      });
    });

    it('extracts dependency from generic Git repository', () => {
      const content = `
pkgname=custom-tool
pkgver=1.5.0
source=("https://git.example.com/owner/custom-tool/archive/v\${pkgver}.tar.gz")
sha256sums=('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'https://git.example.com/owner/custom-tool.git',
            currentValue: 'v1.5.0',
            datasource: 'git-tags',
            managerData: {
              sourceUrl:
                'https://git.example.com/owner/custom-tool/archive/v1.5.0.tar.gz',
              checksums: {
                sha256:
                  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
              },
              pkgver: '1.5.0',
            },
          },
        ],
      });
    });

    it('extracts dependency from direct .git URL', () => {
      const content = `
pkgname=gitea-package
pkgver=2.0.0
source=("https://gitea.example.com/org/repo.git")
sha256sums=('1111111111111111111111111111111111111111111111111111111111111111')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'https://gitea.example.com/org/repo.git',
        datasource: 'git-tags',
      });
    });

    it('extracts dependency from Gitea archive URL', () => {
      const content = `
pkgname=gitea-package
pkgver=1.2.3
source=("https://gitea.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'owner/repo',
            currentValue: 'v1.2.3',
            datasource: 'gitea-tags',
            registryUrls: ['https://gitea.com'],
            managerData: {
              sourceUrl: 'https://gitea.com/owner/repo/archive/v1.2.3.tar.gz',
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

    it('extracts dependency from Codeberg archive URL', () => {
      const content = `
pkgname=codeberg-package
pkgver=2.0.0
source=("https://codeberg.org/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=('abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'owner/repo',
            currentValue: 'v2.0.0',
            datasource: 'gitea-tags',
            registryUrls: ['https://codeberg.org'],
            managerData: {
              sourceUrl:
                'https://codeberg.org/owner/repo/archive/v2.0.0.tar.gz',
              checksums: {
                sha256:
                  'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
              },
              pkgver: '2.0.0',
            },
          },
        ],
      });
    });

    it('extracts dependency from Forgejo archive URL', () => {
      const content = `
pkgname=forgejo-package
pkgver=3.1.0
source=("https://code.forgejo.org/owner/repo/archive/v\${pkgver}.tar.gz")
sha512sums=('11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'owner/repo',
            currentValue: 'v3.1.0',
            datasource: 'forgejo-tags',
            registryUrls: ['https://code.forgejo.org'],
            managerData: {
              sourceUrl:
                'https://code.forgejo.org/owner/repo/archive/v3.1.0.tar.gz',
              checksums: {
                sha512:
                  '11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
              },
              pkgver: '3.1.0',
            },
          },
        ],
      });
    });

    it('extracts dependency from self-hosted Gitea', () => {
      const content = `
pkgname=custom-package
pkgver=1.0.0
source=("https://gitea.mycompany.com/team/project/archive/v\${pkgver}.tar.gz")
sha256sums=('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'team/project',
            currentValue: 'v1.0.0',
            datasource: 'gitea-tags',
            registryUrls: ['https://gitea.mycompany.com'],
            managerData: {
              sourceUrl:
                'https://gitea.mycompany.com/team/project/archive/v1.0.0.tar.gz',
              checksums: {
                sha256:
                  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
              },
              pkgver: '1.0.0',
            },
          },
        ],
      });
    });

    it('extracts dependency from self-hosted Forgejo', () => {
      const content = `
pkgname=forge-package
pkgver=2.5.0
source=("https://forgejo.example.org/dev/tool/archive/\${pkgver}.tar.gz")
sha256sums=('0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'dev/tool',
            currentValue: '2.5.0',
            datasource: 'forgejo-tags',
            registryUrls: ['https://forgejo.example.org'],
            managerData: {
              sourceUrl:
                'https://forgejo.example.org/dev/tool/archive/2.5.0.tar.gz',
              checksums: {
                sha256:
                  '0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedcba',
              },
              pkgver: '2.5.0',
            },
          },
        ],
      });
    });

    it('handles PyPI with different hostname variations', () => {
      const content = `
pkgver=1.0.0
source=("https://pypi.org/packages/source/p/package/package-\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'package',
        currentValue: '1.0.0',
        datasource: 'pypi',
      });
    });

    it('uses filename fallback for truly unsupported sources', () => {
      const content = `
pkgver=1.0.0
source=("ftp://ftp.example.com/package-1.0.0.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'aur/package',
            currentValue: '1.0.0',
            datasource: 'repology',
            managerData: {
              sourceUrl: 'ftp://ftp.example.com/package-1.0.0.tar.gz',
              checksums: {},
              pkgver: '1.0.0',
            },
          },
        ],
      });
    });

    it('uses Repology as fallback for unsupported sources with pkgname', () => {
      const content = `
pkgname=custom-package
pkgver=1.5.0
source=("https://example.com/downloads/custom-package-\${pkgver}.tar.gz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'aur/custom-package',
            currentValue: '1.5.0',
            datasource: 'repology',
            managerData: {
              sourceUrl:
                'https://example.com/downloads/custom-package-1.5.0.tar.gz',
              checksums: {
                sha256:
                  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              },
              pkgver: '1.5.0',
            },
          },
        ],
      });
    });

    it('uses manual Repology configuration from comment', () => {
      const content = `
# renovate: repology=arch_linux_stable/nginx
pkgname=nginx
pkgver=1.24.0
source=("https://nginx.org/download/nginx-\${pkgver}.tar.gz")
sha256sums=('abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'arch_linux_stable/nginx',
            currentValue: '1.24.0',
            datasource: 'repology',
            managerData: {
              sourceUrl: 'https://nginx.org/download/nginx-1.24.0.tar.gz',
              checksums: {
                sha256:
                  'abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
              },
              pkgver: '1.24.0',
            },
          },
        ],
      });
    });

    it('prioritizes manual Repology config over automatic detection', () => {
      const content = `
# renovate: repology=freebsd/custom-pkg
pkgname=custom-package
pkgver=2.0.0
source=("https://example.com/custom-package-\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'freebsd/custom-pkg',
        datasource: 'repology',
      });
    });

    it('uses custom datasource and depName from comment', () => {
      const content = `
# renovate: datasource=cpan depName=LWP
pkgname=carbonio-perl-libwww
pkgver=6.81
source=("https://cpan.metacpan.org/authors/id/O/OA/OALDERS/libwww-perl-\${pkgver}.tar.gz")
sha256sums=('abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'LWP',
        currentValue: '6.81',
        datasource: 'cpan',
      });
    });

    it('custom config overrides auto-detected datasource', () => {
      const content = `
# renovate: datasource=repology depName=arch/openssl
pkgname=carbonio-openssl
pkgver=3.6.1
source=("https://github.com/openssl/openssl/releases/download/openssl-\${pkgver}/openssl-\${pkgver}.tar.gz")
sha256sums=('abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234')
`;
      const result = extractPackageFile(content);
      // Custom config should override the auto-detected github-tags
      expect(result?.deps[0]).toMatchObject({
        depName: 'arch/openssl',
        currentValue: '3.6.1',
        datasource: 'repology',
      });
    });

    it('custom config with extractVersion and versioning', () => {
      const content = `
# renovate: datasource=github-tags depName=nginx/nginx extractVersion=^release-(?<version>.+)$ versioning=semver
pkgname=carbonio-nginx
pkgver=1.28.0
source=("https://nginx.org/download/nginx-\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'nginx/nginx',
        datasource: 'github-tags',
        extractVersion: '^release-(?<version>.+)$',
        versioning: 'semver',
      });
    });

    it('custom config with registryUrl', () => {
      const content = `
# renovate: datasource=gitlab-tags depName=amavis/amavis registryUrl=https://gitlab.com
pkgname=carbonio-amavisd
pkgver=2.14.0
source=("https://gitlab.com/amavis/amavis/-/archive/v\${pkgver}/amavis-v\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'amavis/amavis',
        datasource: 'gitlab-tags',
        registryUrls: ['https://gitlab.com'],
      });
    });

    it('extracts dependency from GitLab source', () => {
      const content = `
pkgname=example-gitlab-package
pkgver=1.2.3
source=("https://gitlab.com/test-owner/test-repo/-/archive/v\${pkgver}/test-repo-v\${pkgver}.tar.gz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'test-owner/test-repo',
            currentValue: 'v1.2.3',
            datasource: 'gitlab-tags',
            managerData: {
              sourceUrl:
                'https://gitlab.com/test-owner/test-repo/-/archive/v1.2.3/test-repo-v1.2.3.tar.gz',
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

    it('falls back to Repology for unparseable source URLs', () => {
      const content = `
pkgname=invalid-url-pkg
pkgver=1.0.0
source=("hxxp://invalid-protocol-url")
`;
      const result = extractPackageFile(content);
      expect(result).not.toBeNull();
      // Should fall back to Repology when URL can't be parsed but pkgname exists
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/invalid-url-pkg',
        currentValue: '1.0.0',
        datasource: 'repology',
      });
    });

    it('logs debug message when no checksums are found', () => {
      const content = `
pkgname=no-checksums
pkgver=1.0.0
source=("https://github.com/test/test/archive/v\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result).not.toBeNull();
      expect(result?.deps[0].managerData?.checksums).toEqual({});
    });

    it('returns null for GitHub URLs with insufficient path parts', () => {
      const content = `
pkgname=invalid-github
pkgver=1.0.0
source=("https://github.com/only-one-part")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for GitHub URLs without version info', () => {
      const content = `
pkgname=no-version
pkgver=1.0.0
source=("https://github.com/owner/repo/somethingelse")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for GitLab URLs with insufficient path parts', () => {
      const content = `
pkgname=invalid-gitlab
pkgver=1.0.0
source=("https://gitlab.com/only-one")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for GitLab URLs without archive path', () => {
      const content = `
pkgname=no-archive
pkgver=1.0.0
source=("https://gitlab.com/owner/repo/somethingelse")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('extracts dependency from Packagist URL with packages path', () => {
      const content = `
pkgname=packagist-package
pkgver=1.0.0
source=("https://packagist.org/packages/vendor/package")
`;
      const result = extractPackageFile(content);
      expect(result).not.toBeNull();
      expect(result?.deps[0]).toMatchObject({
        datasource: 'packagist',
        depName: 'vendor/package',
      });
      expect(result?.deps[0].currentValue).toBeUndefined();
    });

    it('extracts dependency from Packagist download URL', () => {
      const content = `
pkgname=packagist-download
pkgver=2.5.0
source=("https://repo.packagist.org/downloads/vendor-package-2.5.0.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result).not.toBeNull();
      expect(result?.deps[0]).toMatchObject({
        datasource: 'packagist',
        currentValue: '2.5.0',
      });
    });

    it('returns null for invalid Packagist URLs', () => {
      const content = `
pkgname=invalid-packagist
pkgver=1.0.0
source=("https://packagist.org/invalid")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('handles tar.bz2 file extension in GitHub archive URLs', () => {
      const content = `
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.bz2")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
        datasource: 'github-tags',
      });
    });

    it('handles tar.xz file extension in GitHub archive URLs', () => {
      const content = `
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.xz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
        datasource: 'github-tags',
      });
    });

    it('handles .zip file extension in GitHub archive URLs', () => {
      const content = `
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.zip")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
        datasource: 'github-tags',
      });
    });

    it('handles tar.bz2 file extension in PyPI URLs', () => {
      const content = `
pkgver=1.0.0
source=("https://files.pythonhosted.org/packages/source/p/package/package-1.0.0.tar.bz2")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        datasource: 'pypi',
        currentValue: '1.0.0',
      });
    });

    it('handles .zip file extension in PyPI URLs', () => {
      const content = `
pkgver=1.0.0
source=("https://files.pythonhosted.org/packages/source/p/package/package-1.0.0.zip")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        datasource: 'pypi',
        currentValue: '1.0.0',
      });
    });

    it('returns null for npm URLs with insufficient path parts', () => {
      const content = `
pkgname=invalid-npm
pkgver=1.0.0
source=("https://registry.npmjs.org/package")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for npm URLs with invalid filename', () => {
      const content = `
pkgname=invalid-npm-filename
pkgver=1.0.0
source=("https://registry.npmjs.org/package/-/invalid-filename")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for npm scoped package with insufficient path parts', () => {
      const content = `
pkgname=invalid-scoped
pkgver=1.0.0
source=("https://registry.npmjs.org/@scope/package/-")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for CPAN URLs without filename', () => {
      const content = `
pkgname=invalid-cpan
pkgver=1.0.0
source=("https://cpan.metacpan.org/authors/id/")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for CPAN URLs with invalid filename format', () => {
      const content = `
pkgname=invalid-cpan-format
pkgver=1.0.0
source=("https://cpan.metacpan.org/authors/id/A/AB/ABC/invalidfile")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for generic git URLs without archive path and not ending in .git', () => {
      const content = `
pkgname=invalid-git
pkgver=1.0.0
source=("https://git.example.com/owner/repo/something")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for generic git URLs with insufficient path parts for .git', () => {
      const content = `
pkgname=invalid-git-path
pkgver=1.0.0
source=("https://git.example.com/repo.git")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for Gitea URLs with archive but no version after extension removal', () => {
      const content = `
pkgname=gitea-noversion
pkgver=1.0.0
source=("https://gitea.com/owner/repo/archive/.tar.gz")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for Forgejo URLs with archive but no version after extension removal', () => {
      const content = `
pkgname=forgejo-noversion
pkgver=1.0.0
source=("https://code.forgejo.org/owner/repo/archive/.tar.gz")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('returns null for generic git URLs with archive but no version after extension removal', () => {
      const content = `
pkgname=git-noversion
pkgver=1.0.0
source=("https://git.example.com/owner/repo/archive/.tar.gz")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result).not.toBeNull();
      expect(result?.deps[0].datasource).toBe('repology');
    });

    it('handles pypi.python.org hostname variant', () => {
      const content = `
pkgver=1.0.0
source=("https://pypi.python.org/packages/source/p/package/package-1.0.0.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        datasource: 'pypi',
        currentValue: '1.0.0',
      });
    });

    it('handles registry.npmjs.com hostname variant', () => {
      const content = `
pkgver=1.0.0
source=("https://registry.npmjs.com/package/-/package-1.0.0.tgz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        datasource: 'npm',
        currentValue: '1.0.0',
      });
    });

    it('handles CPAN URLs with cpan in hostname', () => {
      const content = `
pkgver=1.0.0
source=("https://www.cpan.org/authors/id/A/AB/ABC/Module-Name-1.0.0.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        datasource: 'cpan',
        currentValue: '1.0.0',
      });
    });

    it('handles filename without version pattern as fallback', () => {
      const content = `
pkgname=simple-pkg
pkgver=1.0.0
source=("https://example.com/downloads/simple-archive.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/simple-pkg',
        datasource: 'repology',
      });
    });

    it('returns null when unable to determine source data after all fallbacks', () => {
      const content = `
pkgver=1.0.0
source=("https://example.com/")
`;
      // No pkgname and URL can't extract package name
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('falls back to Repology for CPAN URL with empty path', () => {
      const content = `
pkgname=empty-cpan
pkgver=1.0.0
source=("https://cpan.metacpan.org/")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/empty-cpan',
        datasource: 'repology',
      });
    });

    it('falls back to Repology for Forgejo URL without archive path', () => {
      const content = `
pkgname=forgejo-no-archive
pkgver=1.0.0
source=("https://code.forgejo.org/owner/repo/releases")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/forgejo-no-archive',
        datasource: 'repology',
      });
    });

    it('handles URL parsing errors gracefully', () => {
      const content = `
pkgname=invalid-url
pkgver=1.0.0
source=("not-a-valid-url-at-all")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/invalid-url',
        datasource: 'repology',
      });
    });

    it('extracts package name from filename with simple extension pattern', () => {
      const content = `
pkgver=1.0.0
source=("https://example.com/downloads/mypackage.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/mypackage',
        datasource: 'repology',
      });
    });

    it('extracts multiple architecture-specific b2sums', () => {
      const content = `
pkgname=test-b2
pkgver=1.0.0
source=("https://github.com/test/b2/archive/v\${pkgver}.tar.gz")
b2sums_x86_64=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1')
b2sums_aarch64=('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.checksums?.b2).toEqual([
        {
          value:
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
          suffix: '_x86_64',
        },
        {
          value:
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          suffix: '_aarch64',
        },
      ]);
    });

    it('extracts multiple architecture-specific md5sums', () => {
      const content = `
pkgname=test-md5
pkgver=1.0.0
source=("https://github.com/test/md5/archive/v\${pkgver}.tar.gz")
md5sums_x86_64=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
md5sums_aarch64=('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.checksums?.md5).toEqual([
        { value: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', suffix: '_x86_64' },
        { value: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', suffix: '_aarch64' },
      ]);
    });

    it('falls back to Repology for PyPI URL with empty filename', () => {
      const content = `
pkgname=pypi-empty
pkgver=1.0.0
source=("https://files.pythonhosted.org/packages/source/p/package/")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/pypi-empty',
        datasource: 'repology',
      });
    });

    it('falls back to Repology for PyPI URL with non-matching filename', () => {
      const content = `
pkgname=pypi-nomatch
pkgver=1.0.0
source=("https://files.pythonhosted.org/packages/source/p/package/README.txt")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/pypi-nomatch',
        datasource: 'repology',
      });
    });

    it('returns null for filename that matches no pattern', () => {
      const content = `
pkgver=1.0.0
source=("https://example.com/downloads/noextension")
`;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('falls back to Repology for PyPI URL with root path only', () => {
      const content = `
pkgname=pypi-root
pkgver=1.0.0
source=("https://files.pythonhosted.org/")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/pypi-root',
        datasource: 'repology',
      });
    });

    it('extracts multiple sources with pkgver tracking', () => {
      const content = `
pkgname=multi-source
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "https://github.com/owner/repo/releases/download/v\${pkgver}/file.sig"
        "local.patch")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.multiSource).toMatchObject({
        sources: [
          {
            url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            usesPkgver: true,
          },
          {
            url: 'https://github.com/owner/repo/releases/download/v${pkgver}/file.sig',
            usesPkgver: true,
          },
          { url: 'local.patch', usesPkgver: false },
        ],
        checksums: {
          sha256: [
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          ],
        },
      });
    });

    it('extracts SKIP checksums in multi-source', () => {
      const content = `
pkgname=skip-source
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "local.patch")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            'SKIP')
`;
      const result = extractPackageFile(content);
      expect(
        result?.deps[0].managerData?.multiSource?.checksums?.sha256,
      ).toEqual([
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'SKIP',
      ]);
    });

    it('extracts sources with unquoted URLs', () => {
      const content = `
pkgname=unquoted-source
pkgver=1.0.0
source=(https://github.com/owner/repo/archive/v\${pkgver}.tar.gz)
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
        datasource: 'github-tags',
      });
    });

    it('extracts checksums without quotes', () => {
      const content = `
pkgname=unquoted-checksums
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=(aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)
`;
      const result = extractPackageFile(content);
      expect(
        result?.deps[0].managerData?.multiSource?.checksums?.sha256,
      ).toEqual([
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ]);
    });

    it('handles empty checksums array', () => {
      const content = `
pkgname=empty-checksums
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=()
`;
      const result = extractPackageFile(content);
      expect(
        result?.deps[0].managerData?.multiSource?.checksums?.sha256,
      ).toBeUndefined();
    });

    it('handles GitHub archive URL with version directly without refs/tags', () => {
      const content = `
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/1.0.0.tar.gz")
sha256sums=('abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: '1.0.0',
        datasource: 'github-tags',
      });
    });

    it('handles GitLab version without file extension', () => {
      const content = `
pkgver=1.0.0
source=("https://gitlab.com/owner/repo/-/archive/v1.0.0/repo-v1.0.0")
sha256sums=('abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1')
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology since no extension to remove
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
        datasource: 'gitlab-tags',
      });
    });

    it('handles Packagist URL without filename in path', () => {
      const content = `
pkgname=packagist-nofn
pkgver=1.0.0
source=("https://repo.packagist.org/downloads/")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/packagist-nofn',
        datasource: 'repology',
      });
    });

    it('handles Gitea archive URL without version', () => {
      const content = `
pkgname=gitea-noversion2
pkgver=1.0.0
source=("https://gitea.com/owner/repo/archive/v1.0.0")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      // URL has version without extension, should work
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
        datasource: 'gitea-tags',
      });
    });

    it('handles Forgejo archive URL without version', () => {
      const content = `
pkgname=forgejo-noversion2
pkgver=1.0.0
source=("https://code.forgejo.org/owner/repo/archive/v1.0.0")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
        datasource: 'forgejo-tags',
      });
    });

    it('handles generic git archive URL without version', () => {
      const content = `
pkgname=git-noversion2
pkgver=1.0.0
source=("https://git.example.com/owner/repo/archive/v1.0.0")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'https://git.example.com/owner/repo.git',
        currentValue: 'v1.0.0',
        datasource: 'git-tags',
      });
    });

    it('handles .git URL with single path component', () => {
      const content = `
pkgname=single-path-git
pkgver=1.0.0
source=("https://git.example.com/repo.git")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/single-path-git',
        datasource: 'repology',
      });
    });

    it('handles source with mixed quoted and unquoted entries', () => {
      const content = `
pkgname=mixed-quotes
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        unquoted-local.patch
        'single-quoted.patch')
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.multiSource?.sources).toEqual([
        {
          url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
          usesPkgver: true,
        },
        { url: 'unquoted-local.patch', usesPkgver: false },
        { url: 'single-quoted.patch', usesPkgver: false },
      ]);
    });

    it('extracts sources with $_pkgver variable', () => {
      const content = `
pkgname=underscore-pkgver
pkgver=1.0.0
_pkgver=1.0.0
source=("https://example.com/package-$_pkgver.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(
        result?.deps[0].managerData?.multiSource?.sources[0],
      ).toMatchObject({
        url: 'https://example.com/package-$_pkgver.tar.gz',
        usesPkgver: true,
      });
    });

    it('extracts sources with ${_pkgver} variable', () => {
      const content = `
pkgname=braced-underscore-pkgver
pkgver=1.0.0
_pkgver=1.0.0
source=("https://example.com/package-\${_pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(
        result?.deps[0].managerData?.multiSource?.sources[0],
      ).toMatchObject({
        url: 'https://example.com/package-${_pkgver}.tar.gz',
        usesPkgver: true,
      });
    });

    it('returns empty multiSource when no source block exists', () => {
      // This tests the extractAllSources returning empty when no block match
      // We use extractPackageFile which will fail anyway since we need a source
      // but internal extractAllSources will be called and return empty array
      const content = `
pkgname=no-source-block
pkgver=1.0.0
# No source array at all - just a comment about source
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // This should return null because there's no source
      expect(result).toBeNull();
    });

    it('returns null when variable does not exist in URL', () => {
      const content = `
pkgname=test-novar
pkgver=1.0.0
source=("https://example.com/\${nonexistent}/file.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // URL with unexpanded variable can't be parsed, extraction fails
      expect(result).toBeNull();
    });

    it('handles variable expansion with non-matching prefix', () => {
      const content = `
pkgname=test-prefix-nomatch
pkgver=1.0.0
source=("https://example.com/\${pkgver#v}/file.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // Prefix 'v' doesn't match, should return original value
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/1.0.0/file.tar.gz',
      );
    });

    it('handles variable expansion with non-matching suffix', () => {
      const content = `
pkgname=test-suffix-nomatch
pkgver=1.0.0
source=("https://example.com/\${pkgver%-beta}/file.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // Suffix '-beta' doesn't match, should return original value
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/1.0.0/file.tar.gz',
      );
    });

    it('handles variable expansion with empty operator operand', () => {
      const content = `
pkgname=test-empty-operand
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/\${pkgver#}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // Empty operand should just return the value
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://github.com/owner/repo/archive/1.0.0.tar.gz',
      );
    });

    it('handles multiple variable expansions in one URL', () => {
      const content = `
pkgname=multi-var
pkgver=1.0.0
_name=package
source=("https://example.com/\${_name}-\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/package-1.0.0.tar.gz',
      );
    });

    it('handles simple $var expansion', () => {
      const content = `
pkgname=simple-var
pkgver=1.0.0
_name=package
source=("https://example.com/$_name-$pkgver.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/package-1.0.0.tar.gz',
      );
    });

    it('handles mixed ${var} and $var in same URL', () => {
      const content = `
pkgname=mixed-syntax
pkgver=1.0.0
_name=package
source=("https://example.com/$_name-\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/package-1.0.0.tar.gz',
      );
    });

    it('handles prefix removal with matching prefix', () => {
      const content = `
pkgname=prefix-match
pkgver=v1.0.0
source=("https://example.com/\${pkgver#v}/file.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/1.0.0/file.tar.gz',
      );
    });

    it('handles suffix removal with matching suffix', () => {
      const content = `
pkgname=suffix-match
pkgver=1.0.0-rc1
source=("https://example.com/\${pkgver%-rc1}/file.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/1.0.0/file.tar.gz',
      );
    });

    it('handles complex variable patterns with pkgname', () => {
      const content = `
pkgname=complex-pkg
pkgver=1.0.0
source=("https://example.com/\${pkgname}-\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/complex-pkg-1.0.0.tar.gz',
      );
    });

    it('falls back to Repology when URL has unexpanded variables', () => {
      const content = `
pkgname=preserve-unknown
pkgver=1.0.0
source=("https://example.com/$unknown_var/file-\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // URL with unknown variable falls back to Repology
      expect(result?.deps[0].datasource).toBe('repology');
      expect(result?.deps[0].depName).toBe('aur/preserve-unknown');
    });

    it('handles pkgname variable expansion in sources', () => {
      const content = `
pkgname=my-package
pkgver=2.5.0
source=("https://example.com/downloads/\${pkgname}-\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // Falls back to Repology but sourceUrl should be expanded
      expect(result?.deps[0].datasource).toBe('repology');
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/downloads/my-package-2.5.0.tar.gz',
      );
    });

    it('expands _pkgname variable in sources', () => {
      const content = `
pkgname=test-pkg
pkgver=1.0.0
_pkgname=actual-package
source=("https://example.com/\${_pkgname}-\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/actual-package-1.0.0.tar.gz',
      );
    });

    it('handles variable expansion in filename extraction', () => {
      const content = `
pkgname=filename-var
pkgver=3.2.1
_name=myapp
source=("https://example.com/downloads/\${_name}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // Should use expanded _name in sourceUrl
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://example.com/downloads/myapp.tar.gz',
      );
    });

    it('handles suffix removal at the beginning of string', () => {
      const content = `
pkgname=suffix-begin
pkgver=1.0.0
_name=name-package
source=("https://github.com/owner/\${_name%-package}/archive/v\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://github.com/owner/name/archive/v1.0.0.tar.gz',
      );
    });

    it('handles source array with extra whitespace', () => {
      const content = `
pkgname=spaces-test
pkgver=1.0.0
source=(   "https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"   )
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0].depName).toBe('owner/repo');
      expect(result?.deps[0].currentValue).toBe('v1.0.0');
    });

    it('handles multiSource tracking with variable references', () => {
      const content = `
pkgname=multi-track
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "local-\${pkgver}.patch")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            'SKIP')
`;
      const result = extractPackageFile(content);
      // First source uses pkgver
      expect(
        result?.deps[0].managerData?.multiSource?.sources[0].usesPkgver,
      ).toBe(true);
      // Second source also references pkgver (even though it's local)
      expect(
        result?.deps[0].managerData?.multiSource?.sources[1].usesPkgver,
      ).toBe(true);
    });

    it('preserves original URL format in managerData for simple expansion', () => {
      const content = `
pkgname=preserve-format
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // sourceUrl should be expanded for update function
      expect(result?.deps[0].managerData?.sourceUrl).toBe(
        'https://github.com/owner/repo/archive/v1.0.0.tar.gz',
      );
      expect(result?.deps[0].managerData?.pkgver).toBe('1.0.0');
    });

    it('handles variable in checksum line comment', () => {
      const content = `
pkgname=checksum-comment
pkgver=1.0.0
_arch=x86_64
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
# Checksum for \${_arch}
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      // Variables in comments should not affect extraction
      expect(result?.deps[0].managerData?.checksums.sha256).toBe(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
    });

    it('handles pkgver with inline comment', () => {
      const content = `
pkgname=comment-pkg
pkgver=1.0.0 # this is a comment
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
        datasource: 'github-tags',
      });
    });

    it('returns null when pkgver contains bash $_ variable', () => {
      const content = `
pkgname=bash-var-pkg
pkgver=$_custom_version
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('returns null when pkgver contains bash $( subshell', () => {
      const content = `
pkgname=subshell-pkg
pkgver=$(git describe --tags)
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('handles pkgname with inline comment', () => {
      const content = `
pkgname=commented-name # this is a comment
pkgver=1.0.0
source=("https://example.com/commented-name-1.0.0.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/commented-name',
        datasource: 'repology',
      });
    });

    it('returns null when pkgname contains $_ bash variable', () => {
      const content = `
pkgname=$_dynamic_name
pkgver=1.0.0
source=("https://example.com/pkg-1.0.0.tar.gz")
`;
      const result = extractPackageFile(content);
      // pkgname with bash variable is skipped, falls back to filename extraction
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/pkg',
        datasource: 'repology',
      });
    });

    it('returns null when pkgname contains $( subshell', () => {
      const content = `
pkgname=$(echo test)
pkgver=1.0.0
source=("https://example.com/pkg-1.0.0.tar.gz")
`;
      const result = extractPackageFile(content);
      // pkgname with bash variable is skipped, falls back to filename extraction
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/pkg',
        datasource: 'repology',
      });
    });

    it('skips array-style pkgname', () => {
      const content = `
pkgname=(foo bar baz)
pkgver=1.0.0
source=("https://example.com/pkg-1.0.0.tar.gz")
`;
      const result = extractPackageFile(content);
      // Array-style pkgname is skipped, falls back to filename extraction
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/pkg',
        datasource: 'repology',
      });
    });

    it('handles parameter substitution with unknown variable', () => {
      const content = `
pkgname=test-unknown-param
pkgver=1.0.0
source=("https://example.com/\${_unknown_var%suffix}/file-\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      // Unknown variable in ${var%suffix} pattern should leave it unexpanded,
      // which then triggers the unexpanded variable check
      expect(result).toBeNull();
    });

    it('handles source with filename::url format', () => {
      const content = `
pkgname=filename-url
pkgver=1.0.0
source=("custom-name.tar.gz::https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;
      const result = extractPackageFile(content);
      expect(result?.deps[0]).toMatchObject({
        depName: 'owner/repo',
        currentValue: 'v1.0.0',
        datasource: 'github-tags',
      });
    });

    it('handles source block with empty parentheses for extractSource', () => {
      const content = `
pkgname=empty-source
pkgver=1.0.0
source=()
`;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('returns null when pkgver contains ${ bash variable', () => {
      const content = `
pkgname=braced-var-pkg
pkgver=\${_upstream_version}
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
`;
      const result = extractPackageFile(content);
      expect(result).toBeNull();
    });

    it('returns null when pkgname contains ${ bash variable', () => {
      const content = `
pkgname=\${_base_name}-git
pkgver=1.0.0
source=("https://example.com/pkg-1.0.0.tar.gz")
`;
      const result = extractPackageFile(content);
      // pkgname with bash variable is skipped, falls back to filename extraction
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/pkg',
        datasource: 'repology',
      });
    });

    it('handles GitHub archive URL with no version segment', () => {
      const content = `
pkgname=gh-no-version
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/")
`;
      const result = extractPackageFile(content);
      // GitHub archive with no version should fall back to Repology
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/gh-no-version',
        datasource: 'repology',
      });
    });

    it('handles GitLab archive URL with missing version segment', () => {
      const content = `
pkgname=gl-no-version
pkgver=1.0.0
source=("https://gitlab.com/owner/repo/-/archive/")
`;
      const result = extractPackageFile(content);
      // GitLab archive with no version should fall back to Repology
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/gl-no-version',
        datasource: 'repology',
      });
    });

    it('handles Gitea archive URL with missing version after archive', () => {
      const content = `
pkgname=gitea-missing-ver
pkgver=1.0.0
source=("https://gitea.com/owner/repo/archive/")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/gitea-missing-ver',
        datasource: 'repology',
      });
    });

    it('handles Forgejo archive URL with missing version after archive', () => {
      const content = `
pkgname=forgejo-missing-ver
pkgver=1.0.0
source=("https://code.forgejo.org/owner/repo/archive/")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/forgejo-missing-ver',
        datasource: 'repology',
      });
    });

    it('handles generic git archive URL with missing version after archive', () => {
      const content = `
pkgname=git-missing-ver
pkgver=1.0.0
source=("https://git.example.com/owner/repo/archive/")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/git-missing-ver',
        datasource: 'repology',
      });
    });

    it('handles Packagist URL with root-only path (no filename)', () => {
      const content = `
pkgname=packagist-rootonly
pkgver=1.0.0
source=("https://repo.packagist.org/")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology since no parseable path
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/packagist-rootonly',
        datasource: 'repology',
      });
    });

    it('handles GitHub refs/tags URL with missing tag version', () => {
      const content = `
pkgname=gh-refs-tags-noversion
pkgver=1.0.0
source=("https://github.com/owner/repo/archive/refs/tags/")
`;
      const result = extractPackageFile(content);
      // Should fall back to Repology
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/gh-refs-tags-noversion',
        datasource: 'repology',
      });
    });

    it('handles source URL with $_ that cannot be expanded', () => {
      const content = `
pkgname=underscore-unexpanded
pkgver=1.0.0
source=("https://example.com/$_unknown/file.tar.gz")
`;
      const result = extractPackageFile(content);
      // Source URL with unexpanded $_ should return null from extractSource
      expect(result).toBeNull();
    });

    it('handles source URL with ${ that cannot be expanded', () => {
      const content = `
pkgname=braced-url
pkgver=1.0.0
source=("https://example.com/\${_unknown_base}/file.tar.gz")
`;
      const result = extractPackageFile(content);
      // Source URL with unexpanded \${} variable should return null from extractSource
      expect(result).toBeNull();
    });

    it('handles Gitea URL with archive as last path segment', () => {
      const content = `
pkgname=gitea-archive-end
pkgver=1.0.0
source=("https://gitea.com/owner/repo/extra/archive")
`;
      const result = extractPackageFile(content);
      // archive is the last segment, no version after it
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/gitea-archive-end',
        datasource: 'repology',
      });
    });

    it('handles Forgejo URL with archive as last path segment', () => {
      const content = `
pkgname=forgejo-archive-end
pkgver=1.0.0
source=("https://code.forgejo.org/owner/repo/extra/archive")
`;
      const result = extractPackageFile(content);
      // archive is the last segment, no version after it
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/forgejo-archive-end',
        datasource: 'repology',
      });
    });

    it('handles generic git URL with archive as last path segment (trailing slash)', () => {
      const content = `
pkgname=git-archive-end
pkgver=1.0.0
source=("https://git.example.com/owner/repo/extra/archive/")
`;
      const result = extractPackageFile(content);
      // archive is the last segment, no version after it (version undefined)
      expect(result?.deps[0]).toMatchObject({
        depName: 'aur/git-archive-end',
        datasource: 'repology',
      });
    });
  });
});
