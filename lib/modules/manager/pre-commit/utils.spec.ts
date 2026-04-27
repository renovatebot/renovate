import * as hostRules from '../../../util/host-rules.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import {
  extractGitDependency,
  extractGitDependencyMetadata,
  extractPreCommitAdditionalDependencies,
} from './utils.ts';

describe('modules/manager/pre-commit/utils', () => {
  beforeEach(() => {
    hostRules.clear();
  });

  it('extracts git dependency metadata for self-hosted gitlab SCP URLs', () => {
    hostRules.add({
      hostType: 'gitlab',
      matchHost: 'gitlab.enterprise.com',
    });

    expect(
      extractGitDependencyMetadata(
        'git@gitlab.enterprise.com:platform/team-hooks.git',
      ),
    ).toStrictEqual({
      datasource: GitlabTagsDatasource.id,
      depName: 'platform/team-hooks',
      depType: 'repository',
      packageName: 'platform/team-hooks',
      registryUrls: ['https://gitlab.enterprise.com'],
    });
  });

  it('extracts git dependency metadata for self-hosted git protocol URLs', () => {
    hostRules.add({
      hostType: 'github',
      matchHost: 'git.example.com',
    });

    expect(
      extractGitDependencyMetadata('git://git.example.com/org/repo.git'),
    ).toStrictEqual({
      datasource: GithubTagsDatasource.id,
      depName: 'org/repo',
      depType: 'repository',
      packageName: 'org/repo',
      registryUrls: ['https://git.example.com'],
    });
  });

  it('extracts tag dependency details from shared metadata helper', () => {
    expect(
      extractGitDependency('v1.2.3', 'https://github.com/foo/bar.git'),
    ).toStrictEqual({
      currentValue: 'v1.2.3',
      datasource: GithubTagsDatasource.id,
      depName: 'foo/bar',
      depType: 'repository',
      packageName: 'foo/bar',
    });
  });

  it('returns invalid-url metadata for malformed repository URLs', () => {
    expect(extractGitDependencyMetadata('https://github.com/')).toStrictEqual({
      datasource: undefined,
      depName: undefined,
      depType: 'repository',
      packageName: undefined,
      skipReason: 'invalid-url',
    });
  });

  it('extracts node additional dependencies', () => {
    expect(
      extractPreCommitAdditionalDependencies({
        language: 'node',
        additional_dependencies: ['prettier@^3.6.2'],
      }),
    ).toStrictEqual([
      {
        currentValue: '^3.6.2',
        datasource: NpmDatasource.id,
        depName: 'prettier',
        depType: 'pre-commit-node',
        packageName: 'prettier',
      },
    ]);
  });

  it('ignores invalid node additional dependency specs', () => {
    expect(
      extractPreCommitAdditionalDependencies({
        language: 'node',
        additional_dependencies: ['not-a-valid-node-spec'],
      }),
    ).toStrictEqual([]);
  });

  it('extracts python additional dependencies', () => {
    expect(
      extractPreCommitAdditionalDependencies({
        language: 'python',
        additional_dependencies: ['types-requests==2.31.0'],
      }),
    ).toStrictEqual([
      {
        currentValue: '==2.31.0',
        currentVersion: '2.31.0',
        datasource: PypiDatasource.id,
        depName: 'types-requests',
        depType: 'pre-commit-python',
        packageName: 'types-requests',
      },
    ]);
  });

  it('extracts golang additional dependencies', () => {
    expect(
      extractPreCommitAdditionalDependencies({
        language: 'golang',
        additional_dependencies: [
          'github.com/wasilibs/go-shellcheck/cmd/shellcheck@v0.10.0',
        ],
      }),
    ).toStrictEqual([
      {
        currentValue: 'v0.10.0',
        datasource: GoDatasource.id,
        depName: 'github.com/wasilibs/go-shellcheck/cmd/shellcheck',
        depType: 'pre-commit-golang',
      },
    ]);
  });

  it('returns no additional dependencies when language is missing', () => {
    expect(
      extractPreCommitAdditionalDependencies({
        additional_dependencies: ['prettier@^3.6.2'],
      }),
    ).toStrictEqual([]);
  });

  it('returns no additional dependencies when the list is empty', () => {
    expect(
      extractPreCommitAdditionalDependencies({
        language: 'node',
        additional_dependencies: [],
      }),
    ).toStrictEqual([]);
  });
});
