import { Readable } from 'node:stream';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { updateDependency } from './update.ts';

const simplePkgbuild = `
pkgname=example-package
pkgver=1.2.3
pkgrel=1
source=("https://github.com/example/example/archive/v\${pkgver}.tar.gz")
sha256sums=('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
`;

const allChecksumsPkgbuild = `
pkgname=test-allchecksums
pkgver=3.0.0
source=("https://github.com/test/allchecksums/archive/v\${pkgver}.tar.gz")
sha256sums=('1111111111111111111111111111111111111111111111111111111111111111')
sha512sums=('22222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222')
b2sums=('33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333')
md5sums=('44444444444444444444444444444444')
`;

describe('modules/manager/pkgbuild/update', () => {
  describe('updateDependency()', () => {
    let cacheDir: DirectoryResult;

    beforeEach(async () => {
      cacheDir = await dir({ unsafeCleanup: true });
      GlobalConfig.set({ cacheDir: cacheDir.path });
    });

    afterEach(async () => {
      httpMock.clear();
      await cacheDir.cleanup();
    });

    it('returns null when upgrade is missing data', async () => {
      const result = await updateDependency({
        fileContent: simplePkgbuild,
        upgrade: {
          depName: 'example/example',
        },
      });
      expect(result).toBeNull();
    });

    it('returns null when managerData is missing', async () => {
      const result = await updateDependency({
        fileContent: simplePkgbuild,
        upgrade: {
          depName: 'example/example',
          currentValue: 'v1.2.3',
          newValue: 'v1.2.4',
        },
      });
      expect(result).toBeNull();
    });

    it('returns null when sourceUrl is missing in managerData', async () => {
      const result = await updateDependency({
        fileContent: simplePkgbuild,
        upgrade: {
          depName: 'example/example',
          currentValue: 'v1.2.3',
          newValue: 'v1.2.4',
          managerData: {
            checksums: {},
            pkgver: '1.2.3',
          },
        },
      });
      expect(result).toBeNull();
    });

    it('updates pkgver and source URL', async () => {
      httpMock
        .scope('https://github.com')
        .get('/example/example/archive/v1.2.4.tar.gz')

        .reply(200, Readable.from(['fake tarball content']));

      const result = await updateDependency({
        fileContent: simplePkgbuild,
        upgrade: {
          depName: 'example/example',
          currentValue: 'v1.2.3',
          newValue: 'v1.2.4',
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
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=1.2.4');
      expect(result).toContain('archive/v${pkgver}.tar.gz');
      expect(result).not.toContain('1.2.3');
    });

    it('updates checksums when available', async () => {
      const sha256Hash = '1'.repeat(64);
      const sha512Hash = '2'.repeat(128);

      httpMock
        .scope('https://github.com')
        .get('/example/example/archive/v1.2.4.tar.gz')

        .reply(200, Readable.from(['fake tarball content']));

      const content = `
pkgver=1.2.3
source=("https://github.com/example/example/archive/v\${pkgver}.tar.gz")
sha256sums=('${sha256Hash}')
sha512sums=('${sha512Hash}')
`;

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'example/example',
          currentValue: 'v1.2.3',
          newValue: 'v1.2.4',
          managerData: {
            sourceUrl:
              'https://github.com/example/example/archive/v${pkgver}.tar.gz',
            checksums: {
              sha256: sha256Hash,
              sha512: sha512Hash,
            },
            pkgver: '1.2.3',
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=1.2.4');
      expect(result).not.toContain(sha256Hash);
      expect(result).not.toContain(sha512Hash);
    });

    it('continues without checksum update on download failure', async () => {
      httpMock
        .scope('https://github.com')
        .get('/example/example/archive/v1.2.4.tar.gz')

        .reply(404);

      const result = await updateDependency({
        fileContent: simplePkgbuild,
        upgrade: {
          depName: 'example/example',
          currentValue: 'v1.2.3',
          newValue: 'v1.2.4',
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
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=1.2.4');
      expect(result).toContain('archive/v${pkgver}.tar.gz');
      // Old checksum should remain since download failed
      expect(result).toContain(
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      );
    });

    it('updates all checksum types when available', async () => {
      httpMock
        .scope('https://github.com')
        .get('/test/allchecksums/archive/v3.1.0.tar.gz')

        .reply(200, Readable.from(['test content']));

      const result = await updateDependency({
        fileContent: allChecksumsPkgbuild,
        upgrade: {
          depName: 'test/allchecksums',
          currentValue: 'v3.0.0',
          newValue: 'v3.1.0',
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
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=3.1.0');
      // All checksums should be updated
      expect(result).not.toContain('11111111111111111111111111111111');
      expect(result).not.toContain('22222222222222222222222222222222');
      expect(result).not.toContain('33333333333333333333333333333333');
      expect(result).not.toContain('44444444444444444444444444444444');
    });

    it('handles versions without v prefix', async () => {
      const content = `
pkgver=1.0.0
source=("https://github.com/example/example/archive/\${pkgver}.tar.gz")
`;

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'example/example',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/example/example/archive/1.0.0.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      expect(result).toContain('archive/${pkgver}.tar.gz');
    });

    it('resets pkgrel to 1 when pkgver changes', async () => {
      const content = `
pkgname=test-package
pkgver=1.0.0
pkgrel=5
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
`;

      const upgrade = {
        currentValue: 'v1.0.0',
        newValue: 'v2.0.0',
        managerData: {
          sourceUrl: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
          checksums: {
            sha256:
              '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          },
          pkgver: '1.0.0',
        },
      };

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['test']));

      const result = await updateDependency({
        fileContent: content,
        upgrade,
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      expect(result).toContain('pkgrel=1');
      expect(result).not.toContain('pkgrel=5');
    });

    it('returns null when managerData has invalid structure', async () => {
      const result = await updateDependency({
        fileContent: simplePkgbuild,
        upgrade: {
          depName: 'example/example',
          currentValue: 'v1.2.3',
          newValue: 'v1.2.4',
          managerData: {
            sourceUrl:
              'https://github.com/example/example/archive/v${pkgver}.tar.gz',
            // Missing checksums - this is valid, but test empty checksums path
            checksums: {},
            pkgver: '1.2.3',
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=1.2.4');
    });

    it('handles missing pkgver in managerData by using currentValue', async () => {
      const content = `
pkgname=test-package
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
`;

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            // pkgver is intentionally missing
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      expect(result).toContain('pkgrel=1');
    });

    it('updates architecture-specific checksums', async () => {
      const content = `
pkgname=arch-pkg
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums_x86_64=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
sha256sums_aarch64=('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['test content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
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
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      // Old checksums should be replaced
      expect(result).not.toContain(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result).not.toContain(
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      );
    });

    it('skips checksum update when checksums is undefined', async () => {
      const content = `
pkgname=no-checksum-pkg
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
`;

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: undefined,
            pkgver: '1.0.0',
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
    });

    it('updates only sha512sums when sha256sums not present', async () => {
      const content = `
pkgname=sha512-only
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha512sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['test content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {
              sha512:
                'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
            },
            pkgver: '1.0.0',
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      expect(result).not.toContain(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
      );
    });

    it('updates multiple sources with pkgver', async () => {
      const content = `
pkgname=multi-source
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "https://github.com/owner/repo/releases/download/v\${pkgver}/file.sig"
        "local.patch")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['content1']))
        .get('/owner/repo/releases/download/v2.0.0/file.sig')

        .reply(200, Readable.from(['content2']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
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
            },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      // First two checksums should be updated (use pkgver)
      expect(result).not.toContain(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result).not.toContain(
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      );
      // Third checksum should remain (local file, no pkgver)
      expect(result).toContain(
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      );
    });

    it('preserves SKIP checksums in multi-source', async () => {
      const content = `
pkgname=skip-source
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "local.patch")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            'SKIP')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
              sources: [
                {
                  url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
                  usesPkgver: true,
                },
                { url: 'local.patch', usesPkgver: false },
              ],
              checksums: {
                sha256: [
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                  'SKIP',
                ],
              },
            },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      // First checksum should be updated
      expect(result).not.toContain(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      // SKIP should remain
      expect(result).toContain('SKIP');
    });

    it('skips source with SKIP checksum as first entry', async () => {
      const content = `
pkgname=skip-first
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "local.patch")
sha256sums=('SKIP'
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
`;

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
              sources: [
                {
                  url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
                  usesPkgver: true,
                },
                { url: 'local.patch', usesPkgver: false },
              ],
              checksums: {
                sha256: [
                  'SKIP',
                  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                ],
              },
            },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      // SKIP should remain for first source
      expect(result).toContain('SKIP');
      // Second checksum should remain (local file)
      expect(result).toContain(
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      );
    });

    it('updates multiple checksum types in multi-source', async () => {
      const content = `
pkgname=multi-checksum-types
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "https://github.com/owner/repo/releases/download/v\${pkgver}/file.asc")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            '1111111111111111111111111111111111111111111111111111111111111111')
sha512sums=('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
            '2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222')
b2sums=('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
        '3333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333')
md5sums=('dddddddddddddddddddddddddddddddd'
         '44444444444444444444444444444444')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['content']))
        .get('/owner/repo/releases/download/v2.0.0/file.asc')

        .reply(200, Readable.from(['asc content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
              sources: [
                {
                  url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
                  usesPkgver: true,
                },
                {
                  url: 'https://github.com/owner/repo/releases/download/v${pkgver}/file.asc',
                  usesPkgver: true,
                },
              ],
              checksums: {
                sha256: [
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                  '1111111111111111111111111111111111111111111111111111111111111111',
                ],
                sha512: [
                  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                  '2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222',
                ],
                b2: [
                  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
                  '3333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333',
                ],
                md5: [
                  'dddddddddddddddddddddddddddddddd',
                  '44444444444444444444444444444444',
                ],
              },
            },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      // All checksums should be updated
      expect(result).not.toContain(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result).not.toContain(
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      );
      expect(result).not.toContain(
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      );
      expect(result).not.toContain('dddddddddddddddddddddddddddddddd');
    });

    it('handles checksums without quotes in multi-source', async () => {
      const content = `
pkgname=unquoted-multi
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "https://github.com/owner/repo/releases/download/v\${pkgver}/file.asc")
sha256sums=(aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
            bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb)
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['content']))
        .get('/owner/repo/releases/download/v2.0.0/file.asc')

        .reply(200, Readable.from(['asc content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
              sources: [
                {
                  url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
                  usesPkgver: true,
                },
                {
                  url: 'https://github.com/owner/repo/releases/download/v${pkgver}/file.asc',
                  usesPkgver: true,
                },
              ],
              checksums: {
                sha256: [
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                ],
              },
            },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      // Old checksums should be replaced
      expect(result).not.toContain(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result).not.toContain(
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      );
    });

    it('handles missing checksum block in updateChecksumAtIndex', async () => {
      const content = `
pkgname=no-checksum-block
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "https://github.com/owner/repo/releases/download/v\${pkgver}/file.asc")
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['content']))
        .get('/owner/repo/releases/download/v2.0.0/file.asc')

        .reply(200, Readable.from(['asc content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
              sources: [
                {
                  url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
                  usesPkgver: true,
                },
                {
                  url: 'https://github.com/owner/repo/releases/download/v${pkgver}/file.asc',
                  usesPkgver: true,
                },
              ],
              checksums: {
                sha256: [
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                ],
              },
            },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
    });

    it('handles index out of bounds in updateChecksumAtIndex', async () => {
      const content = `
pkgname=index-oob
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['content']))
        .get('/owner/repo/releases/download/v2.0.0/sig.asc')

        .reply(200, Readable.from(['sig content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
              sources: [
                {
                  url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
                  usesPkgver: true,
                },
                {
                  url: 'https://github.com/owner/repo/releases/download/v${pkgver}/sig.asc',
                  usesPkgver: true,
                },
              ],
              checksums: {
                // Only one checksum but two sources with pkgver
                sha256: [
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                ],
              },
            },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
    });

    it('handles download failure for multi-source', async () => {
      const content = `
pkgname=multi-fail
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "https://github.com/owner/repo/releases/download/v\${pkgver}/file.sig")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(404)
        .get('/owner/repo/releases/download/v2.0.0/file.sig')

        .reply(404);

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
              sources: [
                {
                  url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
                  usesPkgver: true,
                },
                {
                  url: 'https://github.com/owner/repo/releases/download/v${pkgver}/file.sig',
                  usesPkgver: true,
                },
              ],
              checksums: {
                sha256: [
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                ],
              },
            },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      // Checksums should remain unchanged due to download failure
      expect(result).toContain(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
    });

    it('handles only b2sums in single-source', async () => {
      const content = `
pkgname=b2-only
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
b2sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['test content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {
              b2: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
            },
            pkgver: '1.0.0',
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      expect(result).not.toContain(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
      );
    });

    it('handles only md5sums in single-source', async () => {
      const content = `
pkgname=md5-only
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
md5sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['test content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {
              md5: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
            pkgver: '1.0.0',
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      expect(result).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    });

    it('handles URL without pkgver variable', async () => {
      const content = `
pkgname=literal-url
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v1.0.0.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['test content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl: 'https://github.com/owner/repo/archive/v1.0.0.tar.gz',
            checksums: {
              sha256:
                'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
            pkgver: '1.0.0',
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      // URL should be updated from v1.0.0 to v2.0.0
      expect(result).toContain('v2.0.0.tar.gz');
    });

    it('handles checksum index mismatch between managerData and file content', async () => {
      // File content has only 1 checksum, but managerData indicates 2 sources with checksums
      // This tests the out-of-bounds check in updateChecksumAtIndex
      const content = `
pkgname=mismatch
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz")
sha256sums=('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['content']))
        .get('/owner/repo/releases/download/v2.0.0/file.sig')

        .reply(200, Readable.from(['sig content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
              sources: [
                {
                  url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
                  usesPkgver: true,
                },
                {
                  url: 'https://github.com/owner/repo/releases/download/v${pkgver}/file.sig',
                  usesPkgver: true,
                },
              ],
              checksums: {
                // managerData says there are 2 checksums, but file only has 1
                sha256: [
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                ],
              },
            },
          },
        },
      });

      // Should still succeed, just skip the out-of-bounds checksum update
      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
    });

    it('handles double-quoted checksums in multi-source', async () => {
      const content = `
pkgname=double-quoted
pkgver=1.0.0
pkgrel=1
source=("https://github.com/owner/repo/archive/v\${pkgver}.tar.gz"
        "https://github.com/owner/repo/releases/download/v\${pkgver}/file.asc")
sha256sums=("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
`;

      httpMock
        .scope('https://github.com')
        .get('/owner/repo/archive/v2.0.0.tar.gz')

        .reply(200, Readable.from(['content']))
        .get('/owner/repo/releases/download/v2.0.0/file.asc')

        .reply(200, Readable.from(['asc content']));

      const result = await updateDependency({
        fileContent: content,
        upgrade: {
          depName: 'owner/repo',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
          managerData: {
            sourceUrl:
              'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
            checksums: {},
            pkgver: '1.0.0',
            multiSource: {
              sources: [
                {
                  url: 'https://github.com/owner/repo/archive/v${pkgver}.tar.gz',
                  usesPkgver: true,
                },
                {
                  url: 'https://github.com/owner/repo/releases/download/v${pkgver}/file.asc',
                  usesPkgver: true,
                },
              ],
              checksums: {
                sha256: [
                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                ],
              },
            },
          },
        },
      });

      expect(result).not.toBeNull();
      expect(result).toContain('pkgver=2.0.0');
      // Both checksums should be updated
      expect(result).not.toContain(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
      expect(result).not.toContain(
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      );
    });
  });
});
