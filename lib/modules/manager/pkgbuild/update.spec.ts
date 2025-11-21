import { Readable } from 'node:stream';
import * as httpMock from '../../../../test/http-mock';
import { updateDependency } from './update';

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
    afterEach(() => {
      httpMock.clear();
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
        .times(4) // Downloaded 4 times for different checksums
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
        .times(4) // Downloaded 4 times for different checksums
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
        .times(4) // Try to download 4 times but fail
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
        .times(4) // Downloaded 4 times for different checksums
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
  });
});
