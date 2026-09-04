import { extractPackageFile } from './index.ts';

const packageFile = 'libman.json';

describe('modules/manager/libman/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid json', () => {
      expect(extractPackageFile('not json', packageFile)).toBeNull();
    });

    it('returns null when libraries is missing', () => {
      expect(extractPackageFile('{"version": "1.0"}', packageFile)).toBeNull();
    });

    it('returns null when libraries is empty', () => {
      expect(
        extractPackageFile('{"version": "1.0", "libraries": []}', packageFile),
      ).toBeNull();
    });

    it('extracts a cdnjs library', () => {
      const content = JSON.stringify({
        version: '1.0',
        defaultProvider: 'cdnjs',
        libraries: [
          {
            provider: 'cdnjs',
            library: 'jquery@3.6.0',
            destination: 'wwwroot/lib/jquery/',
          },
        ],
      });
      const res = extractPackageFile(content, packageFile);
      expect(res?.deps).toEqual([
        {
          depName: 'jquery',
          currentValue: '3.6.0',
          datasource: 'cdnjs',
          packageName: 'jquery',
        },
      ]);
    });

    it('extracts a cdnjs library with a specific asset file', () => {
      const content = JSON.stringify({
        version: '1.0',
        libraries: [
          {
            provider: 'cdnjs',
            library: 'jquery@3.6.0',
            destination: 'wwwroot/lib/jquery/',
            files: ['jquery.min.js'],
          },
        ],
      });
      const res = extractPackageFile(content, packageFile);
      expect(res?.deps).toEqual([
        {
          depName: 'jquery',
          currentValue: '3.6.0',
          datasource: 'cdnjs',
          packageName: 'jquery/jquery.min.js',
        },
      ]);
    });

    it('extracts a jsdelivr library', () => {
      const content = JSON.stringify({
        version: '1.0',
        libraries: [
          {
            provider: 'jsdelivr',
            library: 'bootstrap@5.2.3',
            destination: 'wwwroot/lib/bootstrap/',
          },
        ],
      });
      const res = extractPackageFile(content, packageFile);
      expect(res?.deps).toEqual([
        {
          depName: 'bootstrap',
          currentValue: '5.2.3',
          datasource: 'jsdelivr',
          packageName: 'npm/bootstrap',
        },
      ]);
    });

    it('extracts a jsdelivr library with an npm scope', () => {
      const content = JSON.stringify({
        version: '1.0',
        libraries: [
          {
            provider: 'jsdelivr',
            library: '@popperjs/core@2.11.6',
            destination: 'wwwroot/lib/popper/',
          },
        ],
      });
      const res = extractPackageFile(content, packageFile);
      expect(res?.deps).toEqual([
        {
          depName: '@popperjs/core',
          currentValue: '2.11.6',
          datasource: 'jsdelivr',
          packageName: 'npm/@popperjs/core',
        },
      ]);
    });

    it('uses defaultProvider when provider is not set', () => {
      const content = JSON.stringify({
        version: '1.0',
        defaultProvider: 'jsdelivr',
        libraries: [
          {
            library: 'lodash@4.17.21',
            destination: 'wwwroot/lib/lodash/',
          },
        ],
      });
      const res = extractPackageFile(content, packageFile);
      expect(res?.deps).toEqual([
        {
          depName: 'lodash',
          currentValue: '4.17.21',
          datasource: 'jsdelivr',
          packageName: 'npm/lodash',
        },
      ]);
    });

    it('skips filesystem libraries as local dependencies', () => {
      const content = JSON.stringify({
        version: '1.0',
        libraries: [
          {
            provider: 'filesystem',
            library: '../../SomeLib/dist/',
            destination: 'wwwroot/lib/somelib/',
          },
        ],
      });
      const res = extractPackageFile(content, packageFile);
      expect(res?.deps).toEqual([
        {
          depName: '../../SomeLib/dist/',
          currentValue: undefined,
          skipReason: 'local-dependency',
        },
      ]);
    });

    it('skips libraries without a version', () => {
      const content = JSON.stringify({
        version: '1.0',
        libraries: [
          {
            provider: 'cdnjs',
            library: 'jquery',
            destination: 'wwwroot/lib/jquery/',
          },
        ],
      });
      const res = extractPackageFile(content, packageFile);
      expect(res?.deps).toEqual([
        {
          depName: 'jquery',
          currentValue: undefined,
          datasource: 'cdnjs',
          packageName: 'jquery',
          skipReason: 'unspecified-version',
        },
      ]);
    });

    it('skips a library without any provider or defaultProvider', () => {
      const content = JSON.stringify({
        version: '1.0',
        libraries: [
          {
            library: 'jquery@3.6.0',
            destination: 'wwwroot/lib/jquery/',
          },
        ],
      });
      expect(extractPackageFile(content, packageFile)).toBeNull();
    });

    it('skips a library with unsupported provider', () => {
      const content = JSON.stringify({
        version: '1.0',
        libraries: [
          {
            provider: 'does-not-exist',
            library: 'jquery@3.6.0',
            destination: 'wwwroot/lib/jquery/',
          },
        ],
      });
      expect(extractPackageFile(content, packageFile)).toStrictEqual({
        deps: [
          {
            currentValue: '3.6.0',
            depName: 'jquery',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('skips a library with an empty name', () => {
      const content = JSON.stringify({
        version: '1.0',
        defaultProvider: 'cdnjs',
        libraries: [
          {
            library: '',
            destination: 'wwwroot/lib/empty/',
          },
        ],
      });
      expect(extractPackageFile(content, packageFile)).toBeNull();
    });

    it('extracts multiple libraries', () => {
      const content = JSON.stringify({
        version: '1.0',
        defaultProvider: 'cdnjs',
        libraries: [
          {
            provider: 'cdnjs',
            library: 'jquery@3.6.0',
            destination: 'wwwroot/lib/jquery/',
          },
          {
            provider: 'jsdelivr',
            library: 'bootstrap@5.2.3',
            destination: 'wwwroot/lib/bootstrap/',
          },
          {
            provider: 'unpkg',
            library: 'react@19.2.6',
            destination: 'wwwroot/react/',
          },
          {
            provider: 'filesystem',
            library: '../../SomeLib/',
            destination: 'wwwroot/lib/somelib/',
          },
        ],
      });
      const res = extractPackageFile(content, packageFile);
      expect(res?.deps).toHaveLength(4);
    });
  });
});
