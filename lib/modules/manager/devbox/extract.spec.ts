import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

describe('modules/manager/devbox/extract', () => {
  describe('extractPackageFile', () => {
    it('returns null when the devbox JSON file is empty', () => {
      const result = extractPackageFile('', 'devbox.lock');
      expect(result).toBeNull();
    });

    it('returns null when the devbox JSON file is malformed', () => {
      const result = extractPackageFile('malformed json}}}}}', 'devbox.lock');
      expect(result).toBeNull();
    });

    it('returns null when the devbox JSON file has no packages', () => {
      const result = extractPackageFile('{}', 'devbox.lock');
      expect(result).toBeNull();
    });

    it('returns a package dependency when the devbox JSON file has a single package', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": ["nodejs@20.1.8"]
          }
        `,
        'devbox.lock',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'devbox',
          },
        ],
      });
    });

    it('returns a package dependency when the devbox JSON file has a single package with a version object', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": {
              "nodejs": "20.1.8"
            }
          }
        `,
        'devbox.lock',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'devbox',
          },
        ],
      });
    });

    it('returns invalid-version when the devbox JSON file has a single package with an invalid version', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": {
              "nodejs": "^20.1.8"
            }
          }
        `,
        'devbox.lock',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '^20.1.8',
            datasource: 'devbox',
            depName: 'nodejs',
            skipReason: 'invalid-version',
          },
        ],
      });
    });

    it('returns a package dependency when the devbox JSON file has multiple packages', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": ["nodejs@20.1.8", "yarn@1.22.10"]
          }
        `,
        'devbox.lock',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'devbox',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'devbox',
          },
        ],
      });
    });

    it('returns a package dependency when the devbox JSON file has multiple packages with in a packages object', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": {
              "nodejs": "20.1.8",
              "yarn": "1.22.10"
            }
          }
        `,
        'devbox.lock',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'devbox',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'devbox',
          },
        ],
      });
    });

    it('returns a package dependency when the devbox JSON file has multiple packages with package objects', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": {
              "nodejs": {
                "version": "20.1.8"
              },
              "yarn": {
                "version": "1.22.10"
              }
            }
          }
        `,
        'devbox.lock',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'devbox',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'devbox',
          },
        ],
      });
    });

    it('returns invalid dependencies', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": {
              "nodejs": "20.1.8",
              "yarn": "1.22.10",
              "invalid": "invalid"
            }
          }
        `,
        'devbox.lock',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'devbox',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'devbox',
          },
          {
            currentValue: 'invalid',
            datasource: 'devbox',
            depName: 'invalid',
            skipReason: 'invalid-version',
          },
        ],
      });
    });

    it('returns invalid dependencies with package objects', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": {
              "nodejs": "20.1.8",
              "yarn": "1.22.10",
              "invalid": {
                "version": "invalid"
              }
            }
          }
        `,
        'devbox.lock',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'devbox',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'devbox',
          },
          {
            currentValue: 'invalid',
            datasource: 'devbox',
            depName: 'invalid',
            skipReason: 'invalid-version',
          },
        ],
      });
    });

    it('returns invalid dependencies from the packages array', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": ["nodejs@20.1.8", "yarn@1.22.10", "invalid@invalid", "invalid2"]
          }
        `,
        'devbox.lock',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'devbox',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'devbox',
          },
          {
            currentValue: 'invalid',
            datasource: 'devbox',
            depName: 'invalid',
            skipReason: 'invalid-version',
          },
          {
            datasource: 'devbox',
            depName: 'invalid2',
            skipReason: 'not-a-version',
          },
        ],
      });
    });

    it('returns null if there are no dependencies', () => {
      const result = extractPackageFile(
        codeBlock`
          {
            "packages": []
          }
        `,
        'devbox.lock',
      );
      expect(result).toBeNull();
    });
  });
});
