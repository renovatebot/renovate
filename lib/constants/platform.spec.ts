import { AzureTagsDatasource } from '../modules/datasource/azure-tags/index.ts';
import { BitbucketServerTagsDatasource } from '../modules/datasource/bitbucket-server-tags/index.ts';
import { BitbucketTagsDatasource } from '../modules/datasource/bitbucket-tags/index.ts';
import { ForgejoTagsDatasource } from '../modules/datasource/forgejo-tags/index.ts';
import { GiteaTagsDatasource } from '../modules/datasource/gitea-tags/index.ts';
import { GithubReleasesDatasource } from '../modules/datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../modules/datasource/github-tags/index.ts';
import { GitlabPackagesDatasource } from '../modules/datasource/gitlab-packages/index.ts';
import { GitlabReleasesDatasource } from '../modules/datasource/gitlab-releases/index.ts';
import { GitlabTagsDatasource } from '../modules/datasource/gitlab-tags/index.ts';
import { HermitDatasource } from '../modules/datasource/hermit/index.ts';
import { PodDatasource } from '../modules/datasource/pod/index.ts';
import { id as GITHUB_CHANGELOG_ID } from '../workers/repository/update/pr/changelog/github/index.ts';
import { id as GITLAB_CHANGELOG_ID } from '../workers/repository/update/pr/changelog/gitlab/index.ts';
import type { GitHostFamilyId } from './platforms.ts';
import {
  BITBUCKET_API_USING_HOST_TYPES,
  BITBUCKET_SERVER_API_USING_HOST_TYPES,
  FORGEJO_API_USING_HOST_TYPES,
  GITEA_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
  GIT_HOST_FAMILIES,
} from './platforms.ts';

describe('constants/platform', () => {
  it('should be part of the GITEA_API_USING_HOST_TYPES', () => {
    expect(
      GITEA_API_USING_HOST_TYPES.includes(GiteaTagsDatasource.id),
    ).toBeTrue();
    expect(GITEA_API_USING_HOST_TYPES.includes('gitea')).toBeTrue();
  });

  it('should be part of the FORGEJO_API_USING_HOST_TYPES', () => {
    expect(FORGEJO_API_USING_HOST_TYPES.includes('forgejo')).toBeTrue();
    expect(FORGEJO_API_USING_HOST_TYPES.includes('forgejo-tags')).toBeTrue();
    expect(
      FORGEJO_API_USING_HOST_TYPES.includes('forgejo-releases'),
    ).toBeTrue();
    expect(
      FORGEJO_API_USING_HOST_TYPES.includes('forgejo-changelog'),
    ).toBeTrue();
    expect(FORGEJO_API_USING_HOST_TYPES).toHaveLength(4);
  });

  it('should be part of the GITLAB_API_USING_HOST_TYPES', () => {
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(GitlabTagsDatasource.id),
    ).toBeTrue();
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(GitlabReleasesDatasource.id),
    ).toBeTrue();
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(GitlabPackagesDatasource.id),
    ).toBeTrue();
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(GITLAB_CHANGELOG_ID),
    ).toBeTrue();
    expect(GITLAB_API_USING_HOST_TYPES.includes('gitlab')).toBeTrue();
  });

  it('should be not part of the GITLAB_API_USING_HOST_TYPES', () => {
    expect(GITLAB_API_USING_HOST_TYPES.includes('github')).toBeFalse();
  });

  it('should be part of the GITHUB_API_USING_HOST_TYPES', () => {
    expect(
      GITHUB_API_USING_HOST_TYPES.includes(GithubTagsDatasource.id),
    ).toBeTrue();
    expect(
      GITHUB_API_USING_HOST_TYPES.includes(GithubReleasesDatasource.id),
    ).toBeTrue();
    expect(GITHUB_API_USING_HOST_TYPES.includes(PodDatasource.id)).toBeTrue();
    expect(
      GITHUB_API_USING_HOST_TYPES.includes(HermitDatasource.id),
    ).toBeTrue();
    expect(
      GITHUB_API_USING_HOST_TYPES.includes(GITHUB_CHANGELOG_ID),
    ).toBeTrue();
    expect(GITHUB_API_USING_HOST_TYPES.includes('github')).toBeTrue();
  });

  it('should be not part of the GITHUB_API_USING_HOST_TYPES', () => {
    expect(GITHUB_API_USING_HOST_TYPES.includes('gitlab')).toBeFalse();
  });

  it('should be part of the BITBUCKET_API_USING_HOST_TYPES', () => {
    expect(
      BITBUCKET_API_USING_HOST_TYPES.includes(BitbucketTagsDatasource.id),
    ).toBeTrue();
    expect(BITBUCKET_API_USING_HOST_TYPES.includes('bitbucket')).toBeTrue();
  });

  it('should be part of the BITBUCKET_SERVER_API_USING_HOST_TYPES', () => {
    expect(
      BITBUCKET_SERVER_API_USING_HOST_TYPES.includes(
        BitbucketServerTagsDatasource.id,
      ),
    ).toBeTrue();
    expect(
      BITBUCKET_SERVER_API_USING_HOST_TYPES.includes('bitbucket-server'),
    ).toBeTrue();
  });

  describe('GIT_HOST_FAMILIES', () => {
    // The values every consumer of `detectPlatform` used to hard-code for
    // itself. Keeping them here pins the table to that behaviour.
    it.each`
      family                | tagsDatasource                      | publicHosts                           | webDirPath     | webFilePath
      ${'azure'}            | ${AzureTagsDatasource.id}           | ${['dev.azure.com']}                  | ${'tree/HEAD'} | ${'blob/HEAD'}
      ${'bitbucket'}        | ${BitbucketTagsDatasource.id}       | ${['bitbucket.org', 'bitbucket.com']} | ${'src/HEAD'}  | ${'src/HEAD'}
      ${'bitbucket-server'} | ${BitbucketServerTagsDatasource.id} | ${[]}                                 | ${'browse'}    | ${'browse'}
      ${'forgejo'}          | ${ForgejoTagsDatasource.id}         | ${['codeberg.org', 'codefloe.com']}   | ${'tree/HEAD'} | ${'blob/HEAD'}
      ${'gitea'}            | ${GiteaTagsDatasource.id}           | ${['gitea.com']}                      | ${'tree/HEAD'} | ${'blob/HEAD'}
      ${'github'}           | ${GithubTagsDatasource.id}          | ${['github.com']}                     | ${'tree/HEAD'} | ${'blob/HEAD'}
      ${'gitlab'}           | ${GitlabTagsDatasource.id}          | ${['gitlab.com']}                     | ${'tree/HEAD'} | ${'blob/HEAD'}
    `(
      'describes $family',
      ({
        family,
        tagsDatasource,
        publicHosts,
        webDirPath,
        webFilePath,
      }: {
        family: GitHostFamilyId;
        tagsDatasource: string;
        publicHosts: string[];
        webDirPath: string;
        webFilePath: string;
      }) => {
        expect(GIT_HOST_FAMILIES[family]).toMatchObject({
          tagsDatasource,
          publicHosts,
          webDirPath,
          webFilePath,
        });
      },
    );

    it.each`
      family                | baseUrl                          | apiBaseUrl
      ${'azure'}            | ${'https://dev.azure.com/'}      | ${null}
      ${'bitbucket'}        | ${'https://bitbucket.org/'}      | ${'https://api.bitbucket.org/'}
      ${'bitbucket'}        | ${'https://bitbucket.com/'}      | ${'https://api.bitbucket.org/'}
      ${'bitbucket-server'} | ${'https://stash.example.com/'}  | ${'https://stash.example.com/rest/api/1.0/'}
      ${'forgejo'}          | ${'https://codeberg.org/'}       | ${'https://codeberg.org/api/v1/'}
      ${'gitea'}            | ${'https://gitea.com/'}          | ${'https://gitea.com/api/v1/'}
      ${'github'}           | ${'https://github.com/'}         | ${'https://api.github.com/'}
      ${'github'}           | ${'https://github.example.com/'} | ${'https://github.example.com/api/v3/'}
      ${'gitlab'}           | ${'https://gitlab.com/'}         | ${'https://gitlab.com/api/v4/'}
    `(
      'derives the $family api base url from $baseUrl',
      ({
        family,
        baseUrl,
        apiBaseUrl,
      }: {
        family: GitHostFamilyId;
        baseUrl: string;
        apiBaseUrl: string | null;
      }) => {
        expect(GIT_HOST_FAMILIES[family].apiBaseUrl?.(baseUrl) ?? null).toBe(
          apiBaseUrl,
        );
      },
    );

    it('has pairwise disjoint host types', () => {
      const seen = new Set<string>();
      for (const { apiUsingHostTypes } of Object.values(GIT_HOST_FAMILIES)) {
        for (const hostType of apiUsingHostTypes) {
          expect(seen.has(hostType)).toBeFalse();
          seen.add(hostType);
        }
      }
    });
  });
});
