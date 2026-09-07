import * as hostRules from '../../util/host-rules.ts';
import { GitRefsDatasource } from '../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../datasource/gitlab-tags/index.ts';
import type { GitTagsSource, ResolveGitTagsSourceConfig } from './types.ts';
import { type PackageDependency } from './types.ts';
import {
  applyGitSource,
  artifactErrorMessageFromExecError,
  resolveGitTagsSource,
} from './util.ts';

describe('modules/manager/util', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  it('applies GitHub source for tag', () => {
    const dependency: PackageDependency = {};
    const git = 'https://github.com/foo/bar';
    const tag = 'v1.2.3';

    applyGitSource(dependency, git, undefined, tag, undefined);

    expect(dependency).toStrictEqual({
      datasource: GithubTagsDatasource.id,
      registryUrls: ['https://github.com'],
      packageName: 'foo/bar',
      currentValue: tag,
      skipReason: undefined,
    });
  });

  it('applies GitLab source for tag', () => {
    const dependency: PackageDependency = {};
    const git = 'https://gitlab.com/foo/bar';
    const tag = 'v1.2.3';

    applyGitSource(dependency, git, undefined, tag, undefined);

    expect(dependency).toStrictEqual({
      datasource: GitlabTagsDatasource.id,
      registryUrls: ['https://gitlab.com'],
      packageName: 'foo/bar',
      currentValue: tag,
      skipReason: undefined,
    });
  });

  it('applies other git source for tag', () => {
    const dependency: PackageDependency = {};
    const git = 'https://a-git-source.com/foo/bar';
    const tag = 'v1.2.3';

    applyGitSource(dependency, git, undefined, tag, undefined);

    expect(dependency).toStrictEqual({
      datasource: GitTagsDatasource.id,
      packageName: git,
      currentValue: tag,
      skipReason: undefined,
    });
  });

  it('applies git source with subdomain', () => {
    const dependency: PackageDependency = {};
    const git = 'https://git.example.com/foo/bar';
    const tag = 'v1.2.3';

    hostRules.add({
      hostType: 'github',
      matchHost: 'git.example.com',
    });
    applyGitSource(dependency, git, undefined, tag, undefined);

    expect(dependency).toStrictEqual({
      datasource: GithubTagsDatasource.id,
      packageName: 'foo/bar',
      currentValue: tag,
      registryUrls: ['https://git.example.com'],
      skipReason: undefined,
    });
  });

  it('applies GitHub source for tag with SSH URL', () => {
    const dependency: PackageDependency = {};
    const git = 'ssh://git@github.com/foo/bar';
    const tag = 'v1.2.3';

    applyGitSource(dependency, git, undefined, tag, undefined);

    expect(dependency).toStrictEqual({
      datasource: GithubTagsDatasource.id,
      registryUrls: ['https://github.com'],
      packageName: 'foo/bar',
      currentValue: tag,
      skipReason: undefined,
    });
  });

  it('applies GitLab source for tag with SSH URL', () => {
    const dependency: PackageDependency = {};
    const git = 'ssh://git@gitlab.com/foo/bar';
    const tag = 'v1.2.3';

    applyGitSource(dependency, git, undefined, tag, undefined);

    expect(dependency).toStrictEqual({
      datasource: GitlabTagsDatasource.id,
      registryUrls: ['https://gitlab.com'],
      packageName: 'foo/bar',
      currentValue: tag,
      skipReason: undefined,
    });
  });

  it('applies GitHub source for tag with HTTPS URL', () => {
    const dependency: PackageDependency = {};
    const git = 'https://github.com/foo/bar';
    const tag = 'v1.2.3';

    applyGitSource(dependency, git, undefined, tag, undefined);

    expect(dependency).toStrictEqual({
      datasource: GithubTagsDatasource.id,
      registryUrls: ['https://github.com'],
      packageName: 'foo/bar',
      currentValue: tag,
      skipReason: undefined,
    });
  });

  it('applies git source for rev', () => {
    const dependency: PackageDependency = {};
    const git = 'https://github.com/foo/bar';
    const rev = 'abc1234';

    applyGitSource(dependency, git, rev, undefined, undefined);

    expect(dependency).toStrictEqual({
      datasource: GitRefsDatasource.id,
      packageName: git,
      currentDigest: rev,
      replaceString: rev,
      skipReason: undefined,
    });
  });

  it('skips git source for branch', () => {
    const dependency: PackageDependency = {};
    const git = 'https://github.com/foo/bar';
    const branch = 'main';

    applyGitSource(dependency, git, undefined, undefined, branch);

    expect(dependency).toStrictEqual({
      datasource: GitRefsDatasource.id,
      packageName: git,
      currentValue: branch,
      skipReason: 'git-dependency',
    });
  });

  it('skips git source for git only', () => {
    const dependency: PackageDependency = {};
    const git = 'https://github.com/foo/bar';

    applyGitSource(dependency, git, undefined, undefined, undefined);

    expect(dependency).toStrictEqual({
      datasource: GitRefsDatasource.id,
      packageName: git,
      currentValue: undefined,
      skipReason: 'unspecified-version',
    });
  });
});

describe('modules/manager/util', () => {
  it('returns stderr when present', () => {
    const message = artifactErrorMessageFromExecError(
      { stderr: 'some error', stdout: 'some output' },
      'fallback message',
    );

    expect(message).toBe('some error');
  });

  it('returns stdout when stderr is empty', () => {
    const message = artifactErrorMessageFromExecError(
      { stderr: '', stdout: 'some output' },
      'fallback message',
    );

    expect(message).toBe('some output');
  });

  it('returns stdout when stderr is only whitespace', () => {
    const message = artifactErrorMessageFromExecError(
      { stderr: '   ', stdout: 'some output' },
      'fallback message',
    );

    expect(message).toBe('some output');
  });

  it('returns stdout when stderr is undefined', () => {
    const message = artifactErrorMessageFromExecError(
      { stdout: 'some output' },
      'fallback message',
    );

    expect(message).toBe('some output');
  });

  it('returns fallback message when neither stderr nor stdout are present', () => {
    const message = artifactErrorMessageFromExecError({}, 'fallback message');

    expect(message).toBe('fallback message');
  });

  it('returns fallback message when stderr and stdout are only whitespace', () => {
    const message = artifactErrorMessageFromExecError(
      { stderr: '  ', stdout: '  ' },
      'fallback message',
    );

    expect(message).toBe('fallback message');
  });
});

describe('modules/manager/util', () => {
  describe('resolveGitTagsSource', () => {
    beforeEach(() => {
      hostRules.clear();
    });

    it.each`
      url                                                | config                              | expected
      ${'https://github.com/foo/bar'}                    | ${undefined}                        | ${{ datasource: 'github-tags', packageName: 'foo/bar' }}
      ${'https://github.com/foo/bar.git'}                | ${undefined}                        | ${{ datasource: 'github-tags', packageName: 'foo/bar' }}
      ${'ssh://git@github.com/foo/bar'}                  | ${undefined}                        | ${{ datasource: 'github-tags', packageName: 'foo/bar' }}
      ${'git@github.com:foo/bar.git'}                    | ${undefined}                        | ${{ datasource: 'github-tags', packageName: 'foo/bar' }}
      ${'https://github.example.com/foo/bar'}            | ${undefined}                        | ${{ datasource: 'github-tags', packageName: 'foo/bar', registryUrls: ['https://github.example.com'] }}
      ${'ssh://git@github.example.com/foo/bar'}          | ${undefined}                        | ${{ datasource: 'github-tags', packageName: 'foo/bar', registryUrls: ['https://github.example.com'] }}
      ${'git@github.example.com:foo/bar.git'}            | ${undefined}                        | ${{ datasource: 'github-tags', packageName: 'foo/bar', registryUrls: ['https://github.example.com'] }}
      ${'https://gitlab.com/foo/bar'}                    | ${undefined}                        | ${{ datasource: 'gitlab-tags', packageName: 'foo/bar' }}
      ${'ssh://git@gitlab.com/foo/bar'}                  | ${undefined}                        | ${{ datasource: 'gitlab-tags', packageName: 'foo/bar' }}
      ${'git@gitlab.com:foo/bar.git'}                    | ${undefined}                        | ${{ datasource: 'gitlab-tags', packageName: 'foo/bar' }}
      ${'https://gitlab.example.com/group/sub/bar'}      | ${undefined}                        | ${{ datasource: 'gitlab-tags', packageName: 'group/sub/bar', registryUrls: ['https://gitlab.example.com'] }}
      ${'ssh://git@gitlab.example.com/group/sub/bar'}    | ${undefined}                        | ${{ datasource: 'gitlab-tags', packageName: 'group/sub/bar', registryUrls: ['https://gitlab.example.com'] }}
      ${'git@gitlab.example.com:group/sub/bar.git'}      | ${undefined}                        | ${{ datasource: 'gitlab-tags', packageName: 'group/sub/bar', registryUrls: ['https://gitlab.example.com'] }}
      ${'https://bitbucket.org/foo/bar'}                 | ${{ platforms: ['bitbucket'] }}     | ${{ datasource: 'bitbucket-tags', packageName: 'foo/bar' }}
      ${'git@bitbucket.org:foo/bar.git'}                 | ${{ platforms: ['bitbucket'] }}     | ${{ datasource: 'bitbucket-tags', packageName: 'foo/bar' }}
      ${'https://bitbucket.com/foo/bar'}                 | ${{ platforms: ['bitbucket'] }}     | ${{ datasource: 'bitbucket-tags', packageName: 'foo/bar', registryUrls: ['https://bitbucket.com'] }}
      ${'https://gitea.com/foo/bar'}                     | ${{ platforms: ['gitea'] }}         | ${{ datasource: 'gitea-tags', packageName: 'foo/bar' }}
      ${'ssh://git@gitea.example.com/foo/bar'}           | ${{ platforms: ['gitea'] }}         | ${{ datasource: 'gitea-tags', packageName: 'foo/bar', registryUrls: ['https://gitea.example.com'] }}
      ${'https://github.com/foo/bar'}                    | ${{ platforms: ['gitlab'] }}        | ${{ datasource: 'git-tags', packageName: 'https://github.com/foo/bar' }}
      ${'https://example.com/foo/bar.git'}               | ${undefined}                        | ${{ datasource: 'git-tags', packageName: 'https://example.com/foo/bar.git' }}
      ${'not a url'}                                     | ${undefined}                        | ${{ datasource: 'git-tags', packageName: 'not a url' }}
      ${'ssh://'}                                        | ${undefined}                        | ${{ datasource: 'git-tags', packageName: 'ssh://' }}
      ${'https://github.com/foo/bar'}                    | ${{ keepDefaultRegistryUrl: true }} | ${{ datasource: 'github-tags', packageName: 'foo/bar', registryUrls: ['https://github.com'] }}
      ${'https://gitlab.example.com:8443/foo/bar'}       | ${undefined}                        | ${{ datasource: 'gitlab-tags', packageName: 'foo/bar', registryUrls: ['https://gitlab.example.com:8443'] }}
      ${'ssh://git@gitlab.example.com:2222/foo/bar.git'} | ${undefined}                        | ${{ datasource: 'gitlab-tags', packageName: 'foo/bar', registryUrls: ['https://gitlab.example.com'] }}
    `(
      'resolves $url',
      ({
        url,
        config,
        expected,
      }: {
        url: string;
        config: ResolveGitTagsSourceConfig | undefined;
        expected: GitTagsSource;
      }) => {
        expect(resolveGitTagsSource(url, config)).toStrictEqual(expected);
      },
    );

    it('detects a self-hosted platform via hostRules', () => {
      hostRules.add({ hostType: 'gitlab', matchHost: 'git.example.com' });

      expect(
        resolveGitTagsSource('git@git.example.com:foo/bar.git'),
      ).toStrictEqual({
        datasource: 'gitlab-tags',
        packageName: 'foo/bar',
        registryUrls: ['https://git.example.com'],
      });
    });
  });
});
