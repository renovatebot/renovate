import { codeBlock } from 'common-tags';
import { logger } from '~test/util.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/renovate-config/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty file', () => {
      expect(extractPackageFile('', 'renovate.json')).toBeNull();
    });

    it('returns null for invalid file', () => {
      expect(
        extractPackageFile('this-is-not-json-object', 'renovate.json'),
      ).toBeNull();
    });

    describe('presets', () => {
      it('returns null for a config file without presets', () => {
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
        expect(logger.logger.warn).not.toHaveBeenCalled();
        expect(logger.logger.info).not.toHaveBeenCalled();
        expect(logger.logger.debug).not.toHaveBeenCalled();
      });

      it('returns null for a config file only contains built-in presets', () => {
        expect(
          extractPackageFile(
            codeBlock`
            {
              "extends": ["config:recommended", ":label(test)", "helpers:pinGitHubActionDigests"]
            }
          `,
            'renovate.json',
          ),
        ).toBeNull();
        expect(logger.logger.warn).not.toHaveBeenCalled();
        expect(logger.logger.info).not.toHaveBeenCalled();
        expect(logger.logger.debug).not.toHaveBeenCalled();
      });

      it('provides skipReason for unsupported preset sources', () => {
        expect(
          extractPackageFile(
            codeBlock`
            {
              "extends": [
                "fastcore",
                "http://my.server/users/me/repos/renovate-presets/raw/default.json",
                "local>renovate/presets",
                "local>renovate/presets2#1.2.3"
              ]
            }
          `,
            'renovate.json',
          ),
        ).toEqual({
          deps: [
            {
              depName: 'renovate-config-fastcore',
              skipReason: 'unsupported-datasource',
            },
            {
              depName:
                'http://my.server/users/me/repos/renovate-presets/raw/default.json',
              skipReason: 'unsupported-datasource',
            },
            {
              depName: 'renovate/presets',
              skipReason: 'unsupported-datasource',
            },
            {
              depName: 'renovate/presets2',
              skipReason: 'unsupported-datasource',
            },
          ],
        });
      });

      it('provides skipReason for presets without versions', () => {
        expect(
          extractPackageFile(
            codeBlock`
            {
              "extends": [
                "github>abc/foo",
                "gitlab>abc/bar:xyz",
                "gitea>cde/foo//path/xyz"
              ]
            }
          `,
            'renovate.json',
          ),
        ).toEqual({
          deps: [
            {
              depName: 'abc/foo',
              skipReason: 'unspecified-version',
            },
            {
              depName: 'abc/bar',
              skipReason: 'unspecified-version',
            },
            {
              depName: 'cde/foo',
              skipReason: 'unspecified-version',
            },
          ],
        });
      });

      it('extracts from a config file with GitHub hosted presets', () => {
        expect(
          extractPackageFile(
            codeBlock`
            {
              "extends": [
                "github>abc/foo#1.2.3",
                "github>abc/bar:xyz#1.2.3",
                "github>cde/foo//path/xyz#1.2.3",
                "github>cde/bar:xyz/sub#1.2.3"
              ]
            }
          `,
            'renovate.json',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'github-tags',
              depName: 'abc/foo',
              currentValue: '1.2.3',
            },
            {
              datasource: 'github-tags',
              depName: 'abc/bar',
              currentValue: '1.2.3',
            },
            {
              datasource: 'github-tags',
              depName: 'cde/foo',
              currentValue: '1.2.3',
            },
            {
              datasource: 'github-tags',
              depName: 'cde/bar',
              currentValue: '1.2.3',
            },
          ],
        });
      });

      it('extracts from a config file with GitLab hosted presets', () => {
        expect(
          extractPackageFile(
            codeBlock`
            {
              "extends": [
                "gitlab>abc/foo#1.2.3",
                "gitlab>abc/bar:xyz#1.2.3",
                "gitlab>cde/foo//path/xyz#1.2.3",
                "gitlab>cde/bar:xyz/sub#1.2.3"
              ]
            }
          `,
            'renovate.json',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'gitlab-tags',
              depName: 'abc/foo',
              currentValue: '1.2.3',
            },
            {
              datasource: 'gitlab-tags',
              depName: 'abc/bar',
              currentValue: '1.2.3',
            },
            {
              datasource: 'gitlab-tags',
              depName: 'cde/foo',
              currentValue: '1.2.3',
            },
            {
              datasource: 'gitlab-tags',
              depName: 'cde/bar',
              currentValue: '1.2.3',
            },
          ],
        });
      });

      it('extracts from a config file with Gitea hosted presets', () => {
        expect(
          extractPackageFile(
            codeBlock`
            {
              "extends": [
                "gitea>abc/foo#1.2.3",
                "gitea>abc/bar:xyz#1.2.3",
                "gitea>cde/foo//path/xyz#1.2.3",
                "gitea>cde/bar:xyz/sub#1.2.3"
              ]
            }
          `,
            'renovate.json',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'gitea-tags',
              depName: 'abc/foo',
              currentValue: '1.2.3',
            },
            {
              datasource: 'gitea-tags',
              depName: 'abc/bar',
              currentValue: '1.2.3',
            },
            {
              datasource: 'gitea-tags',
              depName: 'cde/foo',
              currentValue: '1.2.3',
            },
            {
              datasource: 'gitea-tags',
              depName: 'cde/bar',
              currentValue: '1.2.3',
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
              "extends": [
                "github>abc/foo#1.2.3",
              ],
            }
          `,
            'renovate.json5',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'github-tags',
              depName: 'abc/foo',
              currentValue: '1.2.3',
            },
          ],
        });
      });
    });

    describe('constraints', () => {
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
              depName: 'bazelisk',
              packageName: 'bazelbuild/bazelisk',
              versioning: 'semver',
              currentValue: '1.2.3',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
            },
            {
              datasource: 'github-releases',
              depName: 'maven',
              packageName: 'containerbase/maven-prebuild',
              versioning: 'maven',
              currentValue: '4.0.0',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
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
              depName: 'bazelisk',
              packageName: 'bazelbuild/bazelisk',
              versioning: 'semver',
              currentValue: '>= 1.2.3',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
            },
            {
              datasource: 'github-releases',
              depName: 'maven',
              packageName: 'containerbase/maven-prebuild',
              versioning: 'maven',
              currentValue: '< 4.0.0',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
            },
          ],
        });
      });

      it('extracts `ToolName`s from packageRules', () => {
        expect(
          extractPackageFile(
            codeBlock`
            {
              "constraints": {
                "golang": "1.20.5"
              },
              "packageRules": [
                {
                  "matchFileNames": ["go.mod"],
                  "constraints": {
                    "golang": "1.26.0",
                    "gomodMod": "1.2.0"
                  }
                }
              ]
            }
          `,
            'renovate.json',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'github-releases',
              depName: 'golang',
              packageName: 'containerbase/golang-prebuild',
              versioning: 'npm',
              currentValue: '1.20.5',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
            },
            {
              datasource: 'github-releases',
              depName: 'golang',
              packageName: 'containerbase/golang-prebuild',
              versioning: 'npm',
              currentValue: '1.26.0',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
            },
            {
              depName: 'gomodMod',
              skipReason: 'unsupported',
              currentValue: '1.2.0',
              depType: 'constraint',
              commitMessageTopic: '{{{depName}}} constraint',
            },
          ],
        });
      });

      it('handles no `constraints` in packageRules', () => {
        expect(
          extractPackageFile(
            codeBlock`
            {
              "constraints": {
                "golang": "1.20.5"
              },
              "packageRules": [
                {}
              ]
            }
          `,
            'renovate.json',
          ),
        ).toEqual({
          deps: [
            {
              datasource: 'github-releases',
              depName: 'golang',
              packageName: 'containerbase/golang-prebuild',
              versioning: 'npm',
              currentValue: '1.20.5',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
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
              commitMessageTopic: '{{{depName}}} constraint',
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
              depName: 'bazelisk',
              packageName: 'bazelbuild/bazelisk',
              versioning: 'semver',
              currentValue: '>= 1.2.3',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
            },
            {
              datasource: 'github-releases',
              depName: 'maven',
              packageName: 'containerbase/maven-prebuild',
              versioning: 'maven',
              currentValue: '< 4.0.0',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
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
              depName: 'gleam',
              packageName: 'gleam-lang/gleam',
              versioning: 'semver',
              currentValue: '3.4.5',
              depType: 'tool-constraint',
              commitMessageTopic: '{{{depName}}} tool constraint',
            },
          ],
        });
      });
    });

    it('extracts all types of configuration', () => {
      expect(
        extractPackageFile(
          codeBlock`
            {
              "extends": [
                "github>abc/foo#1.2.3",
                "github>abc/bar:xyz#1.2.3",
                "github>cde/foo//path/xyz#1.2.3",
                "github>cde/bar:xyz/sub#1.2.3"
              ],
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
            datasource: 'github-tags',
            depName: 'abc/foo',
            currentValue: '1.2.3',
          },
          {
            datasource: 'github-tags',
            depName: 'abc/bar',
            currentValue: '1.2.3',
          },
          {
            datasource: 'github-tags',
            depName: 'cde/foo',
            currentValue: '1.2.3',
          },
          {
            datasource: 'github-tags',
            depName: 'cde/bar',
            currentValue: '1.2.3',
          },

          {
            datasource: 'github-releases',
            depName: 'bazelisk',
            packageName: 'bazelbuild/bazelisk',
            versioning: 'semver',
            currentValue: '>= 1.2.3',
            depType: 'tool-constraint',
            commitMessageTopic: '{{{depName}}} tool constraint',
          },
          {
            datasource: 'github-releases',
            depName: 'maven',
            packageName: 'containerbase/maven-prebuild',
            versioning: 'maven',
            currentValue: '< 4.0.0',
            depType: 'tool-constraint',
            commitMessageTopic: '{{{depName}}} tool constraint',
          },
        ],
      });
    });
  });
});
