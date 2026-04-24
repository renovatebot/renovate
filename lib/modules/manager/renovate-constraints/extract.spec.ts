import { codeBlock } from 'common-tags';
import { extractPackageFile } from './index.ts';

describe('modules/manager/renovate-constraints/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty file', () => {
      expect(extractPackageFile('', 'renovate.json')).toBeNull();
    });

    it('returns null for invalid file', () => {
      expect(
        extractPackageFile('this-is-not-json-object', 'renovate.json'),
      ).toBeNull();
    });

    it('returns null for a config file without constraints', () => {
      expect(
        extractPackageFile(
          codeBlock`
            {
              "draftPR": true
            }
          `,
          'renovate.json',
        ),
      ).toBeNull();
    });

    it('returns null for a config file has an empty constraints', () => {
      expect(
        extractPackageFile(
          codeBlock`
            {
              "constraints": {}
            }
          `,
          'renovate.json',
        ),
      ).toBeNull();
    });

    it('extracts known `ToolName`s with explicit versions', () => {
      expect(
        extractPackageFile(
          codeBlock`
            {
              "constraints": {
                "bazelisk": "1.2.3",
                "maven": "4.0.0"
              }
            }
          `,
          'renovate.json',
        ),
      ).toEqual({
        deps: [
          {
            datasource: 'github-releases',
            packageName: 'bazelbuild/bazelisk',
            versioning: 'semver',
            currentValue: '1.2.3',
            depType: 'tool-constraint',
          },
          {
            datasource: 'github-releases',
            packageName: 'containerbase/maven-prebuild',
            versioning: 'maven',
            currentValue: '4.0.0',
            depType: 'tool-constraint',
          },
        ],
      });
    });

    it('extracts known `ToolName`s with ranges versions', () => {
      expect(
        extractPackageFile(
          codeBlock`
            {
              "constraints": {
                "bazelisk": ">= 1.2.3",
                "maven": "< 4.0.0"
              }
            }
          `,
          'renovate.json',
        ),
      ).toEqual({
        deps: [
          {
            datasource: 'github-releases',
            packageName: 'bazelbuild/bazelisk',
            versioning: 'semver',
            currentValue: '>= 1.2.3',
            depType: 'tool-constraint',
          },
          {
            datasource: 'github-releases',
            packageName: 'containerbase/maven-prebuild',
            versioning: 'maven',
            currentValue: '< 4.0.0',
            depType: 'tool-constraint',
          },
        ],
      });
    });
    it('sets skipReason=unsupported for a constraint that is not a tool', () => {
      expect(
        extractPackageFile(
          codeBlock`
            {
              "constraints": {
                "gomodMod": "1.2.0"
              }
            }
          `,
          'renovate.json',
        ),
      ).toEqual({
        deps: [
          {
            depName: 'gomodMod',
            skipReason: 'unsupported',
            currentValue: '1.2.0',
            depType: 'constraint',
          },
        ],
      });
    });

    it('extracts known `ToolName`s with ranges versions', () => {
      expect(
        extractPackageFile(
          codeBlock`
            {
              "constraints": {
                "bazelisk": ">= 1.2.3",
                "maven": "< 4.0.0"
              }
            }
          `,
          'renovate.json',
        ),
      ).toEqual({
        deps: [
          {
            datasource: 'github-releases',
            packageName: 'bazelbuild/bazelisk',
            versioning: 'semver',
            currentValue: '>= 1.2.3', // TODO
            depType: 'tool-constraint',
          },
          {
            datasource: 'github-releases',
            packageName: 'containerbase/maven-prebuild',
            versioning: 'maven',
            currentValue: '< 4.0.0', // TODO
            depType: 'tool-constraint',
          },
        ],
      });
    });

    it('supports JSON5', () => {
      expect(
        extractPackageFile(
          codeBlock`
                    {
                      // comments are permitted
                      "constraints": {
                        // and no quotes around keys
                        gleam: "3.4.5", // and trailing comma
                      }
                    }
                  `,
          'renovate.json5',
        ),
      ).toEqual({
        deps: [
          {
            datasource: 'github-releases',
            packageName: 'gleam-lang/gleam',
            versioning: 'semver',
            currentValue: '3.4.5',
            depType: 'tool-constraint',
          },
        ],
      });
    });
  });
});
