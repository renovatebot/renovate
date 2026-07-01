import { PypiResponse, PypiSimpleFile, PypiSimpleResponse } from './schema.ts';

describe('modules/datasource/pypi/schema', () => {
  describe('PypiResponseSchema', () => {
    it('parses a valid PyPI JSON response', () => {
      const input = {
        info: {
          name: 'requests',
          home_page: 'https://requests.readthedocs.io',
          project_urls: {
            Homepage: 'https://requests.readthedocs.io',
          },
        },
        releases: {
          '2.28.0': [
            {
              requires_python: '>=3.7',
              upload_time: '2022-06-09T11:11:55',
              yanked: false,
            },
          ],
          '2.27.0': [
            {
              requires_python: null,
              upload_time: '2021-11-16T12:00:00',
              yanked: true,
            },
          ],
        },
      };
      const result = PypiResponse.parse(input);
      expect(result?.info?.name).toBe('requests');
      expect(result?.releases?.['2.28.0']?.[0].requires_python).toBe('>=3.7');
      expect(result?.releases?.['2.27.0']?.[0].requires_python).toBeUndefined();
    });

    it('normalizes null home_page to undefined', () => {
      const input = {
        info: { name: 'pkg', home_page: null },
        releases: {},
      };
      const result = PypiResponse.parse(input);
      expect(result?.info?.home_page).toBeUndefined();
    });

    it('parses a PyPI JSON response with a null home_page', () => {
      const input = {
        info: {
          name: 'mypackage',
          home_page: null,
          project_urls: {
            Repository: 'https://github.com/example/mypackage',
          },
        },
        releases: {},
      };
      const result = PypiResponse.parse(input);
      expect(result?.info?.home_page).toBeUndefined();
      expect(result?.info?.project_urls?.Repository).toBe(
        input.info.project_urls.Repository,
      );
    });

    it('parses a PyPI JSON response with a missing home_page', () => {
      const input = {
        info: {
          name: 'mypackage',
        },
        releases: {},
      };
      const result = PypiResponse.parse(input);
      expect(result?.info?.home_page).toBeUndefined();
      expect(result?.info?.name).toBe(input.info.name);
    });

    it('throws for genuinely invalid input (no error swallowing)', () => {
      expect(() => PypiResponse.parse('not-an-object')).toThrow();
    });

    it('ignores extra fields in info', () => {
      const input = {
        info: {
          name: 'mypackage',
          home_page: 'https://example.com',
          author: 'Someone', // extra field
          license: 'MIT', // extra field
        },
        releases: {},
      };
      const result = PypiResponse.parse(input);
      expect(result?.info?.name).toBe('mypackage');
    });
  });

  describe('PypiSimpleFile', () => {
    it('parses a valid file entry', () => {
      const input = {
        filename: 'package-1.0.0.tar.gz',
        'requires-python': '>=3.7',
        yanked: false,
        'upload-time': '2023-01-01T00:00:00.000Z',
      };

      const result = PypiSimpleFile.parse(input);

      expect(result.filename).toBe('package-1.0.0.tar.gz');
      expect(result['requires-python']).toBe('>=3.7');
      expect(result.yanked).toBe(false);
      expect(result['upload-time']).toBe('2023-01-01T00:00:00.000Z');
    });

    it('handles missing optional fields', () => {
      const input = {
        filename: 'package-1.0.0.tar.gz',
      };

      const result = PypiSimpleFile.parse(input);

      expect(result.filename).toBe('package-1.0.0.tar.gz');
      expect(result['requires-python']).toBeUndefined();
      expect(result.yanked).toBe(false);
      expect(result['upload-time']).toBeUndefined();
    });

    it('normalizes null optional fields to undefined', () => {
      const input = {
        filename: 'package-1.0.0.tar.gz',
        'requires-python': null,
        'upload-time': null,
      };

      const result = PypiSimpleFile.parse(input);

      expect(result['requires-python']).toBeUndefined();
      expect(result['upload-time']).toBeUndefined();
    });

    it('handles yanked as a string reason', () => {
      const input = {
        filename: 'package-1.0.0.tar.gz',
        yanked: 'security vulnerability',
      };

      const result = PypiSimpleFile.parse(input);

      expect(result.yanked).toBe('security vulnerability');
    });

    it('handles yanked as true', () => {
      const input = {
        filename: 'package-1.0.0.tar.gz',
        yanked: true,
      };

      const result = PypiSimpleFile.parse(input);

      expect(result.yanked).toBe(true);
    });
  });

  describe('PypiSimpleResponse', () => {
    it('parses a valid response with files', () => {
      const input = {
        files: [
          {
            filename: 'package-1.0.0.tar.gz',
            'requires-python': '>=3.7',
            yanked: false,
            'upload-time': '2023-01-01T00:00:00.000Z',
          },
          {
            filename: 'package-2.0.0.tar.gz',
            yanked: true,
          },
        ],
      };

      const result = PypiSimpleResponse.parse(input);

      expect(result.files).toHaveLength(2);
      expect(result.files[0].filename).toBe('package-1.0.0.tar.gz');
      expect(result.files[1].yanked).toBe(true);
    });

    it('filters out invalid file entries via LooseArray', () => {
      const input = {
        files: [
          { filename: 'package-1.0.0.tar.gz' },
          { notAFilename: 'invalid' },
          { filename: 'package-2.0.0.tar.gz' },
        ],
      };

      const result = PypiSimpleResponse.parse(input);

      expect(result.files).toHaveLength(2);
      expect(result.files[0].filename).toBe('package-1.0.0.tar.gz');
      expect(result.files[1].filename).toBe('package-2.0.0.tar.gz');
    });

    it('parses an empty files array', () => {
      const input = { files: [] };

      const result = PypiSimpleResponse.parse(input);

      expect(result.files).toHaveLength(0);
    });
  });
});
