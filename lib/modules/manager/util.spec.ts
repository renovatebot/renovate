import type { GitHostFamilyId } from '../../constants/index.ts';
import * as hostRules from '../../util/host-rules.ts';
import { BitbucketTagsDatasource } from '../datasource/bitbucket-tags/index.ts';
import { ForgejoTagsDatasource } from '../datasource/forgejo-tags/index.ts';
import { GitRefsDatasource } from '../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../datasource/git-tags/index.ts';
import { GiteaTagsDatasource } from '../datasource/gitea-tags/index.ts';
import { GithubTagsDatasource } from '../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../datasource/gitlab-tags/index.ts';
import type { GitHostTagsSource } from './types.ts';
import { type PackageDependency } from './types.ts';
import {
  applyGitSource,
  artifactErrorMessageFromExecError,
  gitHostTagsSource,
  isPublicGitHost,
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

  describe('gitHostTagsSource', () => {
    // One row per family a manager may allow-list, so the shared lookup keeps
    // returning what the managers used to derive for themselves.
    it.each`
      url                                     | families                            | expected
      ${'https://github.com/foo/bar'}         | ${['github', 'gitlab']}             | ${{ family: 'github', datasource: GithubTagsDatasource.id }}
      ${'https://gitlab.com/foo/bar'}         | ${['github', 'gitlab']}             | ${{ family: 'gitlab', datasource: GitlabTagsDatasource.id }}
      ${'https://gitlab.example.com/foo/bar'} | ${['github', 'gitlab']}             | ${{ family: 'gitlab', datasource: GitlabTagsDatasource.id }}
      ${'https://bitbucket.org/foo/bar'}      | ${['github', 'gitlab']}             | ${null}
      ${'https://bitbucket.org/foo/bar'}      | ${['gitlab', 'bitbucket', 'gitea']} | ${{ family: 'bitbucket', datasource: BitbucketTagsDatasource.id }}
      ${'https://gitea.com/foo/bar'}          | ${['gitlab', 'bitbucket', 'gitea']} | ${{ family: 'gitea', datasource: GiteaTagsDatasource.id }}
      ${'https://codeberg.org/foo/bar'}       | ${['forgejo', 'gitea', 'github']}   | ${{ family: 'forgejo', datasource: ForgejoTagsDatasource.id }}
      ${'https://example.com/foo/bar'}        | ${['forgejo', 'gitea', 'github']}   | ${null}
      ${'not a url'}                          | ${['github', 'gitlab']}             | ${null}
    `(
      'resolves $url within $families',
      ({
        url,
        families,
        expected,
      }: {
        url: string;
        families: GitHostFamilyId[];
        expected: GitHostTagsSource | null;
      }) => {
        expect(gitHostTagsSource(url, families)).toEqual(expected);
      },
    );
  });

  describe('isPublicGitHost', () => {
    it.each`
      family                | host                    | expected
      ${'github'}           | ${'github.com'}         | ${true}
      ${'github'}           | ${'github.example.com'} | ${false}
      ${'gitlab'}           | ${'gitlab.com'}         | ${true}
      ${'gitlab'}           | ${'gitlab.example.com'} | ${false}
      ${'bitbucket'}        | ${'bitbucket.com'}      | ${true}
      ${'bitbucket-server'} | ${'stash.example.com'}  | ${false}
    `(
      'reports $host as public=$expected for $family',
      ({
        family,
        host,
        expected,
      }: {
        family: GitHostFamilyId;
        host: string;
        expected: boolean;
      }) => {
        expect(isPublicGitHost(family, host)).toBe(expected);
      },
    );
  });
});
