import { isRelativePresetReference, parsePreset } from './parse.ts';
import { PRESET_INVALID } from './util.ts';

describe('config/presets/parse', () => {
  describe('parsePreset', () => {
    // default namespace
    it('returns default package name', () => {
      expect(parsePreset(':base')).toEqual({
        repo: 'default',
        params: undefined,
        rawParams: undefined,
        presetName: 'base',
        presetPath: undefined,
        presetSource: 'internal',
      });
    });

    it('parses github', () => {
      expect(parsePreset('github>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('handles special chars', () => {
      expect(parsePreset('github>some/repo:foo+bar')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'foo+bar',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github subfiles', () => {
      expect(parsePreset('github>some/repo:somefile')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github subfiles with preset name', () => {
      expect(parsePreset('github>some/repo:somefile/somepreset')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'somefile/somepreset',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses github file with preset name with .json extension', () => {
      expect(parsePreset('github>some/repo:somefile.json')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
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
        rawParams: undefined,
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
        rawParams: undefined,
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
          rawParams: undefined,
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
        rawParams: undefined,
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
        rawParams: undefined,
        presetName: 'somefile',
        presetPath: 'somepath/somesubpath',
        presetSource: 'github',
      });
    });

    it('parses github toplevel file using subdirectory syntax', () => {
      expect(parsePreset('github>some/repo//somefile')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'github',
      });
    });

    it('parses gitlab', () => {
      expect(parsePreset('gitlab>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'gitlab',
      });
    });

    it('parses gitea', () => {
      expect(parsePreset('gitea>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'gitea',
      });
    });

    it('parses forgejo', () => {
      expect(parsePreset('forgejo>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'forgejo',
      });
    });

    it('parses local', () => {
      expect(parsePreset('local>some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local with spaces', () => {
      expect(parsePreset('local>A2B CD/A2B_Renovate')).toEqual({
        repo: 'A2B CD/A2B_Renovate',
        params: undefined,
        rawParams: undefined,
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
        rawParams: undefined,
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
        rawParams: undefined,
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
        rawParams: undefined,
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
        rawParams: undefined,
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
        rawParams: undefined,
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
        rawParams: undefined,
        presetName: 'preset/subpreset',
        presetPath: undefined,
        presetSource: 'local',
        tag: 'feature/branch',
      });
    });

    it('parses local repo with presetPath with URL-encoded characters', () => {
      expect(
        parsePreset('local>some%20group/some%20repo//some-dir/some-file'),
      ).toEqual({
        repo: 'some%20group/some%20repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'some-file',
        presetPath: 'some-dir',
        presetSource: 'local',
      });
    });

    it('parses local repo with URL-encoded characters', () => {
      expect(parsePreset('local>some%20group/some%20repo//some-file')).toEqual({
        repo: 'some%20group/some%20repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'some-file',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses no prefix as local', () => {
      expect(parsePreset('some/repo')).toEqual({
        repo: 'some/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local Bitbucket user repo with preset name', () => {
      expect(parsePreset('local>~john_doe/repo//somefile')).toEqual({
        repo: '~john_doe/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'somefile',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('parses local Bitbucket user repo', () => {
      expect(parsePreset('local>~john_doe/renovate-config')).toEqual({
        repo: '~john_doe/renovate-config',
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'local',
      });
    });

    it('returns default package name with params', () => {
      expect(parsePreset(':group(packages/eslint, eslint)')).toEqual({
        repo: 'default',
        params: ['packages/eslint', 'eslint'],
        rawParams: 'packages/eslint, eslint',
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
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns simple scope and params', () => {
      expect(parsePreset('@somescope(param1)')).toEqual({
        repo: '@somescope/renovate-config',
        params: ['param1'],
        rawParams: 'param1',
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and default', () => {
      expect(parsePreset('@somescope/somepackagename')).toEqual({
        repo: '@somescope/somepackagename',
        params: undefined,
        rawParams: undefined,
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
        rawParams: 'param1, param2, param3',
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with presetName', () => {
      expect(parsePreset('@somescope:somePresetName')).toEqual({
        repo: '@somescope/renovate-config',
        params: undefined,
        rawParams: undefined,
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with presetName and params', () => {
      expect(parsePreset('@somescope:somePresetName(param1)')).toEqual({
        repo: '@somescope/renovate-config',
        params: ['param1'],
        rawParams: 'param1',
        presetName: 'somePresetName',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns scope with repo and presetName', () => {
      expect(parsePreset('@somescope/somepackagename:somePresetName')).toEqual({
        repo: '@somescope/somepackagename',
        params: undefined,
        rawParams: undefined,
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
        rawParams: 'param1, param2',
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
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns non-scoped package name', () => {
      expect(parsePreset('somepackage:webapp')).toEqual({
        repo: 'renovate-config-somepackage',
        params: undefined,
        rawParams: undefined,
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns non-scoped package name full', () => {
      expect(parsePreset('renovate-config-somepackage:webapp')).toEqual({
        repo: 'renovate-config-somepackage',
        params: undefined,
        rawParams: undefined,
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('returns non-scoped package name with params', () => {
      expect(parsePreset('somepackage:webapp(param1)')).toEqual({
        repo: 'renovate-config-somepackage',
        params: ['param1'],
        rawParams: 'param1',
        presetName: 'webapp',
        presetPath: undefined,
        presetSource: 'npm',
      });
    });

    it('parses HTTPS URLs for gitea', () => {
      expect(
        parsePreset(
          'https://my.server/gitea/renovate-config/raw/branch/main/default.json',
        ),
      ).toEqual({
        repo: 'https://my.server/gitea/renovate-config/raw/branch/main/default.json',
        params: undefined,
        rawParams: undefined,
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });

    it('parses HTTPS URLs for forgejo', () => {
      expect(
        parsePreset(
          'https://my.server/forgejo/renovate-config/raw/branch/main/default.json',
        ),
      ).toEqual({
        repo: 'https://my.server/forgejo/renovate-config/raw/branch/main/default.json',
        params: undefined,
        rawParams: undefined,
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
        rawParams: undefined,
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });

    it('parses HTTPS URLs with parameters for gitea', () => {
      expect(
        parsePreset(
          'https://my.server/gitea/renovate-config/raw/branch/main/default.json(param1)',
        ),
      ).toEqual({
        repo: 'https://my.server/gitea/renovate-config/raw/branch/main/default.json',
        params: ['param1'],
        rawParams: 'param1',
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });

    it('parses HTTPS URLs with parameters for forgejo', () => {
      expect(
        parsePreset(
          'https://my.server/forgejo/renovate-config/raw/branch/main/default.json(param1)',
        ),
      ).toEqual({
        repo: 'https://my.server/forgejo/renovate-config/raw/branch/main/default.json',
        params: ['param1'],
        rawParams: 'param1',
        presetName: '',
        presetPath: undefined,
        presetSource: 'http',
      });
    });

    it.each`
      input                | presetName
      ${'./foo'}           | ${'./foo'}
      ${'./foo/bar'}       | ${'./foo/bar'}
      ${'./foo.json5'}     | ${'./foo.json5'}
      ${'../foo'}          | ${'../foo'}
      ${'../../foo/bar'}   | ${'../../foo/bar'}
      ${'./foo/../bar'}    | ${'./foo/../bar'}
      ${'./a/../b'}        | ${'./a/../b'}
      ${'/foo'}            | ${'/foo'}
      ${'/foo/bar-baz.js'} | ${'/foo/bar-baz.js'}
    `('parses relative preset $input', ({ input, presetName }) => {
      expect(parsePreset(input as string)).toEqual({
        repo: '',
        params: undefined,
        rawParams: undefined,
        presetName,
        presetPath: undefined,
        presetSource: 'relative',
        tag: undefined,
      });
    });

    it('parses relative preset with params', () => {
      expect(parsePreset('./foo/bar(param1, param2)')).toEqual({
        repo: '',
        params: ['param1', 'param2'],
        rawParams: 'param1, param2',
        presetName: './foo/bar',
        presetPath: undefined,
        presetSource: 'relative',
        tag: undefined,
      });
    });

    it('parses relative preset with params which contain a hash', () => {
      expect(parsePreset('./foo(p#1)')).toEqual({
        repo: '',
        params: ['p#1'],
        rawParams: 'p#1',
        presetName: './foo',
        presetPath: undefined,
        presetSource: 'relative',
        tag: undefined,
      });
    });

    it('parses relative preset with params which contain a sub-expression', () => {
      expect(parsePreset('./group({{ lower (env.TEAM) }})')).toEqual({
        repo: '',
        params: ['{{ lower (env.TEAM) }}'],
        rawParams: '{{ lower (env.TEAM) }}',
        presetName: './group',
        presetPath: undefined,
        presetSource: 'relative',
        tag: undefined,
      });
    });

    it('parses relative preset with empty params', () => {
      expect(parsePreset('./foo()')).toEqual({
        repo: '',
        params: [''],
        rawParams: '',
        presetName: './foo',
        presetPath: undefined,
        presetSource: 'relative',
        tag: undefined,
      });
    });

    it.each`
      input                 | reason
      ${'./foo#v1'}         | ${'tag'}
      ${'./foo(p1)#v1'}     | ${'tag after params'}
      ${'./foo(p1'}         | ${'unclosed params'}
      ${'./foo//bar'}       | ${'double slash'}
      ${'./'}               | ${'no path'}
      ${'/'}                | ${'no path'}
      ${'./foo/'}           | ${'trailing slash'}
      ${'../'}              | ${'no path'}
      ${'/foo bar'}         | ${'space'}
      ${'./.'}              | ${'final segment names a directory'}
      ${'./..'}             | ${'final segment names a directory'}
      ${'./a/..'}           | ${'final segment names a directory'}
      ${'../a/..'}          | ${'final segment names a directory'}
      ${'.././.'}           | ${'final segment names a directory'}
      ${'/a/..'}            | ${'final segment names a directory'}
      ${'./foo:bar'}        | ${'sub-preset'}
      ${'./group(eslint))'} | ${'stray closing parenthesis in params'}
      ${'./foo(a)(b)'}      | ${'two parameter lists'}
      ${'./foo((a)'}        | ${'unclosed parenthesis in params'}
      ${'local>./x'}        | ${'local source prefix'}
      ${'github>../x'}      | ${'github source prefix'}
      ${'npm>./x'}          | ${'npm source prefix'}
      ${'local>npm>./x'}    | ${'chained source prefixes'}
    `('throws for invalid relative preset $input ($reason)', ({ input }) => {
      expect(() => parsePreset(input as string)).toThrow(PRESET_INVALID);
    });

    it.each`
      input   | repo
      ${'.'}  | ${'renovate-config-.'}
      ${'..'} | ${'renovate-config-..'}
    `('keeps npm fallback for $input', ({ input, repo }) => {
      expect(parsePreset(input as string)).toEqual({
        repo,
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
        tag: undefined,
      });
    });

    it.each`
      input           | repo
      ${'npm>foo'}    | ${'renovate-config-foo'}
      ${'npm>@myorg'} | ${'@myorg/renovate-config'}
    `('parses npm preset $input', ({ input, repo }) => {
      expect(parsePreset(input as string)).toEqual({
        repo,
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
        tag: undefined,
      });
    });

    it('parses scoped npm preset with explicit `npm>` prefix', () => {
      expect(parsePreset('npm>@myorg/renovate-config')).toEqual({
        repo: '@myorg/renovate-config',
        params: undefined,
        rawParams: undefined,
        presetName: 'default',
        presetPath: undefined,
        presetSource: 'npm',
        tag: undefined,
      });
    });

    it.each`
      input               | presetSource | repo
      ${'npm>owner/repo'} | ${'local'}   | ${'owner/repo'}
      ${'local>npm>foo'}  | ${'local'}   | ${'foo'}
      ${'github>npm>foo'} | ${'github'}  | ${'foo'}
    `(
      'keeps legacy handling of $input',
      ({ input, presetSource, repo }: Record<string, string>) => {
        expect(parsePreset(input)).toEqual({
          repo,
          params: undefined,
          rawParams: undefined,
          presetName: 'default',
          presetPath: undefined,
          presetSource,
          tag: undefined,
        });
      },
    );

    it('keeps legacy handling of `npm>` presets with a path', () => {
      expect(parsePreset('npm>owner/repo//path/name')).toEqual({
        repo: 'owner/repo',
        params: undefined,
        rawParams: undefined,
        presetName: 'name',
        presetPath: 'path',
        presetSource: 'local',
        tag: undefined,
      });
    });
  });

  describe('isRelativePresetReference', () => {
    it.each`
      input                      | expected
      ${'./foo'}                 | ${true}
      ${'../foo'}                | ${true}
      ${'/foo'}                  | ${true}
      ${'.'}                     | ${false}
      ${'..'}                    | ${false}
      ${'github>a/b'}            | ${false}
      ${'config:best-practices'} | ${false}
      ${'a/b'}                   | ${false}
    `('returns $expected for $input', ({ input, expected }) => {
      expect(isRelativePresetReference(input as string)).toBe(expected);
    });
  });
});
