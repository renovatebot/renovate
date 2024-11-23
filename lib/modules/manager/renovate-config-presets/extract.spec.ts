import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

const noPresets = codeBlock`
  {
    "draftPR": true
  }
`;

const builtInPresets = codeBlock`
  {
    "extends": ["config:recommended", ":label(test)", "helpers:pinGitHubActionDigests"]
  }
`;

const unsupportedPresets = codeBlock`
  {
    "extends": [
      "fastcore",
      "http://my.server/users/me/repos/renovate-presets/raw/default.json",
      "local>renovate/presets",
      "local>renovate/presets2#1.2.3"
    ]
  }
`;

const presetsWithoutVersions = codeBlock`
  {
    "extends": [
      "github>abc/foo",
      "gitlab>abc/bar:xyz",
      "gitea>cde/foo//path/xyz"
    ]
  }
`;

const githubPresets = codeBlock`
  {
    "extends": [
      "github>abc/foo#1.2.3",
      "github>abc/bar:xyz#1.2.3",
      "github>cde/foo//path/xyz#1.2.3",
      "github>cde/bar:xyz/sub#1.2.3"
    ]
  }
`;

const gitlabPresets = codeBlock`
  {
    "extends": [
      "gitlab>abc/foo#1.2.3",
      "gitlab>abc/bar:xyz#1.2.3",
      "gitlab>cde/foo//path/xyz#1.2.3",
      "gitlab>cde/bar:xyz/sub#1.2.3"
    ]
  }
`;

const giteaPresets = codeBlock`
  {
    "extends": [
      "gitea>abc/foo#1.2.3",
      "gitea>abc/bar:xyz#1.2.3",
      "gitea>cde/foo//path/xyz#1.2.3",
      "gitea>cde/bar:xyz/sub#1.2.3"
    ]
  }
`;

const json5Config = codeBlock`
  {
    // comments are permitted
    "extends": [
      "github>abc/foo#1.2.3",
    ],
  }
`;

describe('modules/manager/renovate-config-presets/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty file', () => {
      expect(extractPackageFile('', '')).toBeNull();
    });

    it('returns null for invalid file', () => {
      expect(extractPackageFile('this-is-not-json', '')).toBeNull();
    });

    it('returns null for a config file without presets', () => {
      expect(extractPackageFile(noPresets, '')).toBeNull();
    });

    it('returns null for a config file only contains built-in presets', () => {
      expect(extractPackageFile(builtInPresets, '')).toBeNull();
    });

    it('provides skipReason for unsupported preset sources', () => {
      expect(extractPackageFile(unsupportedPresets, '')).toEqual({
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
      expect(extractPackageFile(presetsWithoutVersions, '')).toEqual({
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
      expect(extractPackageFile(githubPresets, '')).toEqual({
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
      expect(extractPackageFile(gitlabPresets, '')).toEqual({
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
      expect(extractPackageFile(giteaPresets, '')).toEqual({
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
      expect(extractPackageFile(json5Config, '')).toEqual({
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
});
