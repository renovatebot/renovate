import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

describe('modules/manager/devbox/extract', () => {
  describe('extractPackageFile', () => {
    it('returns null when the devbox JSON file is empty', () => {
      const result = extractPackageFile('');
      expect(result).toBeNull();
    });

    it('returns null when the devbox JSON file is malformed', () => {
      const result = extractPackageFile('malformed json}}}}}');
      expect(result).toBeNull();
    });

    it('returns null when the devbox JSON file has no packages', () => {
      const result = extractPackageFile('{}');
      expect(result).toBeNull();
    });

    it('returns a package dependency when the devbox JSON file has a single package', () => {
      const result = extractPackageFile(codeBlock`
        {
          "packages": ["nodejs@20.1.8"]
        }
      `);
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'nixhub',
            packageName: 'node',
            versioning: 'nixhub',
          },
        ],
      });
    });

    it('returns a package dependency when the devbox JSON file has a single package with a version object', () => {
      const result = extractPackageFile(codeBlock`
        {
          "packages": {
            "nodejs": "20.1.8"
          }
        }
      `);
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'nixhub',
            packageName: 'node',
            versioning: 'nixhub',
          },
        ],
      });
    });

    it('returns null when the devbox JSON file has a single package with a version object and a version range', () => {
      const result = extractPackageFile(codeBlock`
        {
          "packages": {
            "nodejs": "^20.1.8"
          }
        }
      `);
      expect(result).toBeNull();
    });

    it('returns a package dependency when the devbox JSON file has multiple packages', () => {
      const result = extractPackageFile(codeBlock`
        {
          "packages": ["nodejs@20.1.8", "yarn@1.22.10"]
        }
      `);
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'nixhub',
            packageName: 'node',
            versioning: 'nixhub',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'nixhub',
            packageName: 'yarn',
            versioning: 'nixhub',
          },
        ],
      });
    });

    it('returns a package dependency when the devbox JSON file has multiple packages with in a packages object', () => {
      const result = extractPackageFile(codeBlock`
        {
          "packages": {
            "nodejs": "20.1.8",
            "yarn": "1.22.10"
          }
        }
      `);
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'nixhub',
            packageName: 'node',
            versioning: 'nixhub',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'nixhub',
            packageName: 'yarn',
            versioning: 'nixhub',
          },
        ],
      });
    });

    it('returns a package dependency when the devbox JSON file has multiple packages with package objects', () => {
      const result = extractPackageFile(codeBlock`
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
      `);
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'nixhub',
            packageName: 'node',
            versioning: 'nixhub',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'nixhub',
            packageName: 'yarn',
            versioning: 'nixhub',
          },
        ],
      });
    });

    it('skips invalid dependencies', () => {
      const result = extractPackageFile(codeBlock`
        {
          "packages": {
            "nodejs": "20.1.8",
            "yarn": "1.22.10",
            "invalid": "invalid"
          }
        }
      `);
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'nixhub',
            packageName: 'node',
            versioning: 'nixhub',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'nixhub',
            packageName: 'yarn',
            versioning: 'nixhub',
          },
        ],
      });
    });

    it('skips invalid dependencies with package objects', () => {
      const result = extractPackageFile(codeBlock`
        {
          "packages": {
            "nodejs": "20.1.8",
            "yarn": "1.22.10",
            "invalid": {
              "version": "invalid"
            }
          }
        }
      `);
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'nixhub',
            packageName: 'node',
            versioning: 'nixhub',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'nixhub',
            packageName: 'yarn',
            versioning: 'nixhub',
          },
        ],
      });
    });

    it('skips invalid dependencies from the packages array', () => {
      const result = extractPackageFile(codeBlock`
        {
          "packages": ["nodejs@20.1.8", "yarn@1.22.10", "invalid@invalid"]
        }
      `);
      expect(result).toEqual({
        deps: [
          {
            depName: 'nodejs',
            currentValue: '20.1.8',
            datasource: 'nixhub',
            packageName: 'node',
            versioning: 'nixhub',
          },
          {
            depName: 'yarn',
            currentValue: '1.22.10',
            datasource: 'nixhub',
            packageName: 'yarn',
            versioning: 'nixhub',
          },
        ],
      });
    });
  });
});
