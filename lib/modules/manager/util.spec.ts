import * as hostRules from '../../util/host-rules';
import { GitRefsDatasource } from '../datasource/git-refs';
import { GitTagsDatasource } from '../datasource/git-tags';
import { GithubTagsDatasource } from '../datasource/github-tags';
import { GitlabTagsDatasource } from '../datasource/gitlab-tags';
import { type PackageDependency } from './types';
import { applyGitSource } from './util';

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
