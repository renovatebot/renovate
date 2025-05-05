import { parsePreset } from './parse';

describe('config/presets/parse', () => {
  describe('parsePreset', () => {
    // default namespace
    it('returns default package name', () => {
      expect(parsePreset(':base')).toEqual({
        repo: 'default',
        params: undefined,
        presetName: 'base',
        presetPath: undefined,
        presetSource: 'internal',
      });
    });

    it('parses github', () => {
      expect(parsePreset('github>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('handles special chars', () => {
      expect(parsePreset('github>some/repo:foo+bar')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'foo+bar',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github subfiles', () => {
      expect(parsePreset('github>some/repo:somefile')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github subfiles with preset name', () => {
      expect(parsePreset('github>some/repo:somefile/somepreset')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile/somepreset',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github file with preset name with .json extension', () => {
      expect(parsePreset('github>some/repo:somefile.json')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile.json',
        presetPath: undefined,
        presetSource: 'github',
        tag: undefined,
      });
    });

    it('parses github file with preset name with .json5 extension', () => {
      expect(parsePreset('github>some/repo:somefile.json5')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile.json5',
        presetPath: undefined,
        presetSource: 'github',
        tag: undefined,
      });
    });

    it('parses github subfiles with preset name with .json extension', () => {
      expect(parsePreset('github>some/repo:somefile.json/somepreset')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile.json/somepreset',
        presetPath: undefined,
        presetSource: 'github',
        tag: undefined,
      });
    });

    it('parses github subfiles with preset name with .json5 extension', () => {
      expect(parsePreset('github>some/repo:somefile.json5/somepreset')).toEqual(
        {
          repo: 'some/repo',
          params: undefined,
          presetName: 'somefile.json5/somepreset',
          presetPath: undefined,
          presetSource: 'github',
          tag: undefined,
        },
      );
    });

    it('parses github subfiles with preset and sub-preset name', () => {
      expect(
        parsePreset('github>some/repo:somefile/somepreset/somesubpreset'),
      ).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile/somepreset/somesubpreset',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github subdirectories', () => {
      expect(
        parsePreset('github>some/repo//somepath/somesubpath/somefile'),
      ).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: 'somepath/somesubpath',
        presetSource: 'github',
      });
    });

    it('parses github toplevel file using subdirectory syntax', () => {
      expect(parsePreset('github>some/repo//somefile')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses gitlab', () => {
      expect(parsePreset('gitlab>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'gitlab',
      });
    });

    it('parses gitea', () => {
      expect(parsePreset('gitea>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'gitea',
      });
    });

    it('parses local', () => {
      expect(parsePreset('local>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local with spaces', () => {
      expect(parsePreset('local>A2B CD/A2B_Renovate')).toEqual({
        repo: 'A2B CD/A2B_Renovate',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local with subdirectory', () => {
      expect(
        parsePreset('local>some-group/some-repo//some-dir/some-file'),
      ).toEqual({
        repo: 'some-group/some-repo',
        params: undefined,
        presetName: 'some-file',
        presetPath: 'some-dir',
        presetSource: 'local',
      });
    });

    it('parses local with spaces and subdirectory', () => {
      expect(
        parsePreset('local>A2B CD/A2B_Renovate//some-dir/some-file'),
      ).toEqual({
        repo: 'A2B CD/A2B_Renovate',
        params: undefined,
        presetName: 'some-file',
        presetPath: 'some-dir',
        presetSource: 'local',
      });
    });

    it('parses local with sub preset and tag', () => {
      expect(
        parsePreset('local>some-group/some-repo:some-file/subpreset#1.2.3'),
      ).toEqual({
        repo: 'some-group/some-repo',
        params: undefined,
        presetName: 'some-file/subpreset',
        presetPath: undefined,
        presetSource: 'local',
        tag: '1.2.3',
      });
    });

    it('parses local with subdirectory and tag', () => {
      expect(
        parsePreset('local>some-group/some-repo//some-dir/some-file#1.2.3'),
      ).toEqual({
        repo: 'some-group/some-repo',
        params: undefined,
        presetName: 'some-file',
        presetPath: 'some-dir',
        presetSource: 'local',
        tag: '1.2.3',
      });
    });

    it('parses local with subdirectory and branch/tag with a slash', () => {
      expect(
        parsePreset('local>PROJECT/repository//path/to/preset#feature/branch'),
      ).toEqual({
        repo: 'PROJECT/repository',
        params: undefined,
        presetName: 'preset',
        presetPath: 'path/to',
        presetSource: 'local',
        tag: 'feature/branch',
      });
    });

    it('parses local with sub preset and branch/tag with a slash', () => {
      expect(
        parsePreset('local>PROJECT/repository:preset/subpreset#feature/branch'),
      ).toEqual({
        repo: 'PROJECT/repository',
        params: undefined,
        presetName: 'preset/subpreset',
        presetPath: undefined,
        presetSource: 'local',
        tag: 'feature/branch',
      });
    });

    it('parses no prefix as local', () => {
      expect(parsePreset('some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local Bitbucket user repo with preset name', () => {
      expect(parsePreset('local>~john_doe/repo//somefile')).toEqual({
        repo: '~john_doe/repo',
        params: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local Bitbucket user repo', () => {
      expect(parsePreset('local>~john_doe/renovate-config')).toEqual({
        repo: '~john_doe/renovate-config',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('returns default package name with params', () => {
      expect(parsePreset(':group(packages/eslint, eslint)')).toEqual({
        repo: 'default',
        params: ['packages/eslint', 'eslint'],
        presetName: 'group',
        presetPath: undefined,
        presetSource: 'internal',
      });
    });

    // scoped namespace
    it('returns simple scope', () => {
      expect(parsePreset('@somescope')).toEqual({
        repo: '@somescope/renovate-config',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns simple scope and params', () => {
      expect(parsePreset('@somescope(param1)')).toEqual({
        repo: '@somescope/renovate-config',
        params: ['param1'],
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and default', () => {
      expect(parsePreset('@somescope/somepackagename')).toEqual({
        repo: '@somescope/somepackagename',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and params and default', () => {
      expect(
        parsePreset('@somescope/somepackagename(param1, param2, param3)'),
      ).toEqual({
        repo: '@somescope/somepackagename',
        params: ['param1', 'param2', 'param3'],
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with presetName', () => {
      expect(parsePreset('@somescope:somePresetName')).toEqual({
        repo: '@somescope/renovate-config',
        params: undefined,
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with presetName and params', () => {
      expect(parsePreset('@somescope:somePresetName(param1)')).toEqual({
        repo: '@somescope/renovate-config',
        params: ['param1'],
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and presetName', () => {
      expect(parsePreset('@somescope/somepackagename:somePresetName')).toEqual({
        repo: '@somescope/somepackagename',
        params: undefined,
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and presetName and params', () => {
      expect(
        parsePreset(
          '@somescope/somepackagename:somePresetName(param1, param2)',
        ),
      ).toEqual({
        repo: '@somescope/somepackagename',
        params: ['param1', 'param2'],
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    // non-scoped namespace
    it('returns non-scoped default', () => {
      expect(parsePreset('somepackage')).toEqual({
        repo: 'renovate-config-somepackage',
        params: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns non-scoped package name', () => {
      expect(parsePreset('somepackage:webapp')).toEqual({
        repo: 'renovate-config-somepackage',
        params: undefined,
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns non-scoped package name full', () => {
      expect(parsePreset('renovate-config-somepackage:webapp')).toEqual({
        repo: 'renovate-config-somepackage',
        params: undefined,
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns non-scoped package name with params', () => {
      expect(parsePreset('somepackage:webapp(param1)')).toEqual({
        repo: 'renovate-config-somepackage',
        params: ['param1'],
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('parses HTTPS URLs', () => {
      expect(
        parsePreset(
          'https://my.server/gitea/renovate-config/raw/branch/main/default.json',
        ),
      ).toEqual({
        repo: 'https://my.server/gitea/renovate-config/raw/branch/main/default.json',
        params: undefined,
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });

    it('parses HTTP URLs', () => {
      expect(
        parsePreset(
          'http://my.server/users/me/repos/renovate-presets/raw/default.json?at=refs%2Fheads%2Fmain',
        ),
      ).toEqual({
        repo: 'http://my.server/users/me/repos/renovate-presets/raw/default.json?at=refs%2Fheads%2Fmain',
        params: undefined,
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });

    it('parses HTTPS URLs with parameters', () => {
      expect(
        parsePreset(
          'https://my.server/gitea/renovate-config/raw/branch/main/default.json(param1)',
        ),
      ).toEqual({
        repo: 'https://my.server/gitea/renovate-config/raw/branch/main/default.json',
        params: ['param1'],
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });
  });
});
