import { PypiResponse } from './schema.ts';

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
});
