import { codeBlock } from 'common-tags';
import { extractPackageFile } from './index.ts';
import { Fixtures } from '~test/fixtures.ts';

const applicationJson = Fixtures.get('application.json');
const packageJson = Fixtures.get('package.json');
const minimalJson = Fixtures.get('minimal.json');

describe('modules/manager/elm/extract', () => {
  describe('extractPackageFile', () => {
    it('returns null for invalid JSON', () => {
      const content = 'invalid json {{{';
      const result = extractPackageFile(content, 'elm.json');
      expect(result).toBeNull();
    });

    it('returns null for invalid elm.json schema', () => {
      const content = codeBlock`
        {
          "type": "unknown",
          "elm-version": "0.19.1"
        }
      `;
      const result = extractPackageFile(content, 'elm.json');
      expect(result).toBeNull();
    });

    it('returns null for missing type field', () => {
      const content = codeBlock`
        {
          "elm-version": "0.19.1"
        }
      `;
      const result = extractPackageFile(content, 'elm.json');
      expect(result).toBeNull();
    });

    it('extracts dependencies from application elm.json', () => {
      const result = extractPackageFile(applicationJson, 'elm.json');
      expect(result).toEqual({
        deps: [
          {
            depName: 'NoRedInk/elm-json-decode-pipeline',
            currentValue: '1.0.0',
            depType: 'dependencies:direct',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/browser',
            currentValue: '1.0.0',
            depType: 'dependencies:direct',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/core',
            currentValue: '1.0.0',
            depType: 'dependencies:direct',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/html',
            currentValue: '1.0.0',
            depType: 'dependencies:direct',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/http',
            currentValue: '1.0.0',
            depType: 'dependencies:direct',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/json',
            currentValue: '1.0.0',
            depType: 'dependencies:direct',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/time',
            currentValue: '1.0.0',
            depType: 'dependencies:direct',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/url',
            currentValue: '1.0.0',
            depType: 'dependencies:direct',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/parser',
            currentValue: '1.0.0',
            depType: 'dependencies:indirect',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/virtual-dom',
            currentValue: '1.0.0',
            depType: 'dependencies:indirect',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm-explorations/test',
            currentValue: '1.0.0',
            depType: 'test-dependencies:direct',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm/random',
            currentValue: '1.0.0',
            depType: 'test-dependencies:indirect',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm',
            packageName: 'elm/compiler',
            currentValue: '0.19.1',
            depType: 'elm-version',
            datasource: 'github-tags',
            versioning: 'elm',
          },
        ],
      });
    });

    it('extracts dependencies from package elm.json', () => {
      const result = extractPackageFile(packageJson, 'elm.json');
      expect(result).toEqual({
        deps: [
          {
            depName: 'elm/json',
            currentValue: '1.0.0 <= v < 2.0.0',
            depType: 'dependencies',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm-explorations/test',
            currentValue: '1.0.0 <= v < 2.0.0',
            depType: 'test-dependencies',
            datasource: 'elm-package',
            versioning: 'elm',
          },
          {
            depName: 'elm',
            packageName: 'elm/compiler',
            currentValue: '0.19.0 <= v < 0.20.0',
            depType: 'elm-version',
            datasource: 'github-tags',
            versioning: 'elm',
          },
        ],
      });
    });

    it('handles minimal application elm.json with no dependencies', () => {
      const result = extractPackageFile(minimalJson, 'elm.json');
      expect(result).toEqual({
        deps: [
          {
            depName: 'elm',
            packageName: 'elm/compiler',
            currentValue: '0.19.1',
            depType: 'elm-version',
            datasource: 'github-tags',
            versioning: 'elm',
          },
        ],
      });
    });

    it('handles package elm.json with empty dependencies', () => {
      const content = codeBlock`
        {
          "type": "package",
          "elm-version": "0.19.0 <= v < 0.20.0"
        }
      `;
      const result = extractPackageFile(content, 'elm.json');
      expect(result).toEqual({
        deps: [
          {
            depName: 'elm',
            packageName: 'elm/compiler',
            currentValue: '0.19.0 <= v < 0.20.0',
            depType: 'elm-version',
            datasource: 'github-tags',
            versioning: 'elm',
          },
        ],
      });
    });
  });
});
