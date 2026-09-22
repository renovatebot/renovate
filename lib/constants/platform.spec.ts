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
import type { PlatformFamilyId } from './platforms.ts';
import { PLATFORM_FAMILIES } from './platforms.ts';

const {
  bitbucket,
  'bitbucket-server': bitbucketServer,
  forgejo,
  gitea,
  github,
  gitlab,
} = PLATFORM_FAMILIES;

// `id` of the changelog modules, which cannot be imported here without
// importing their http clients as well.
const GITHUB_CHANGELOG_ID = 'github-changelog';
const GITLAB_CHANGELOG_ID = 'gitlab-changelog';

describe('constants/platform', () => {
  it('lists the gitea api host types', () => {
    expect(gitea.apiUsingHostTypes.includes(GiteaTagsDatasource.id)).toBeTrue();
    expect(gitea.apiUsingHostTypes.includes('gitea')).toBeTrue();
  });

  it('lists the forgejo api host types', () => {
    expect(forgejo.apiUsingHostTypes.includes('forgejo')).toBeTrue();
    expect(forgejo.apiUsingHostTypes.includes('forgejo-tags')).toBeTrue();
    expect(forgejo.apiUsingHostTypes.includes('forgejo-releases')).toBeTrue();
    expect(forgejo.apiUsingHostTypes.includes('forgejo-changelog')).toBeTrue();
    expect(forgejo.apiUsingHostTypes).toHaveLength(4);
  });

  it('lists the gitlab api host types', () => {
    expect(
      gitlab.apiUsingHostTypes.includes(GitlabTagsDatasource.id),
    ).toBeTrue();
    expect(
      gitlab.apiUsingHostTypes.includes(GitlabReleasesDatasource.id),
    ).toBeTrue();
    expect(
      gitlab.apiUsingHostTypes.includes(GitlabPackagesDatasource.id),
    ).toBeTrue();
    expect(gitlab.apiUsingHostTypes.includes(GITLAB_CHANGELOG_ID)).toBeTrue();
    expect(gitlab.apiUsingHostTypes.includes('gitlab')).toBeTrue();
  });

  it('does not list github as a gitlab api host type', () => {
    expect(gitlab.apiUsingHostTypes.includes('github')).toBeFalse();
  });

  it('lists the github api host types', () => {
    expect(
      github.apiUsingHostTypes.includes(GithubTagsDatasource.id),
    ).toBeTrue();
    expect(
      github.apiUsingHostTypes.includes(GithubReleasesDatasource.id),
    ).toBeTrue();
    expect(github.apiUsingHostTypes.includes(PodDatasource.id)).toBeTrue();
    expect(github.apiUsingHostTypes.includes(HermitDatasource.id)).toBeTrue();
    expect(github.apiUsingHostTypes.includes(GITHUB_CHANGELOG_ID)).toBeTrue();
    expect(github.apiUsingHostTypes.includes('github')).toBeTrue();
  });

  it('does not list gitlab as a github api host type', () => {
    expect(github.apiUsingHostTypes.includes('gitlab')).toBeFalse();
  });

  it('lists the bitbucket api host types', () => {
    expect(
      bitbucket.apiUsingHostTypes.includes(BitbucketTagsDatasource.id),
    ).toBeTrue();
    expect(bitbucket.apiUsingHostTypes.includes('bitbucket')).toBeTrue();
  });

  it('lists the bitbucket-server api host types', () => {
    expect(
      bitbucketServer.apiUsingHostTypes.includes(
        BitbucketServerTagsDatasource.id,
      ),
    ).toBeTrue();
    expect(
      bitbucketServer.apiUsingHostTypes.includes('bitbucket-server'),
    ).toBeTrue();
  });

  describe('PLATFORM_FAMILIES', () => {
    // The values every consumer of `detectPlatform` used to hard-code for
    // itself. Keeping them here pins the table to that behaviour.
    it.each`
      family                | tagsDatasource                      | knownHosts                            | webDirPath
      ${'azure'}            | ${AzureTagsDatasource.id}           | ${['dev.azure.com']}                  | ${'tree/HEAD'}
      ${'bitbucket'}        | ${BitbucketTagsDatasource.id}       | ${['bitbucket.org', 'bitbucket.com']} | ${'src/HEAD'}
      ${'bitbucket-server'} | ${BitbucketServerTagsDatasource.id} | ${[]}                                 | ${'browse'}
      ${'forgejo'}          | ${ForgejoTagsDatasource.id}         | ${['codeberg.org', 'codefloe.com']}   | ${'tree/HEAD'}
      ${'gitea'}            | ${GiteaTagsDatasource.id}           | ${['gitea.com']}                      | ${'tree/HEAD'}
      ${'github'}           | ${GithubTagsDatasource.id}          | ${['github.com']}                     | ${'tree/HEAD'}
      ${'gitlab'}           | ${GitlabTagsDatasource.id}          | ${['gitlab.com']}                     | ${'tree/HEAD'}
    `(
      'describes $family',
      ({
        family,
        tagsDatasource,
        knownHosts,
        webDirPath,
      }: {
        family: PlatformFamilyId;
        tagsDatasource: string;
        knownHosts: string[];
        webDirPath: string;
      }) => {
        expect(PLATFORM_FAMILIES[family]).toMatchObject({
          tagsDatasource,
          knownHosts,
          webDirPath,
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
        family: PlatformFamilyId;
        baseUrl: string;
        apiBaseUrl: string | null;
      }) => {
        expect(PLATFORM_FAMILIES[family].apiBaseUrl?.(baseUrl) ?? null).toBe(
          apiBaseUrl,
        );
      },
    );

    it('has pairwise disjoint host types', () => {
      const seen = new Set<string>();
      for (const { apiUsingHostTypes } of Object.values(PLATFORM_FAMILIES)) {
        for (const hostType of apiUsingHostTypes) {
          expect(seen.has(hostType)).toBeFalse();
          seen.add(hostType);
        }
      }
    });

    it('has pairwise disjoint known hosts', () => {
      const seen = new Set<string>();
      for (const { knownHosts } of Object.values(PLATFORM_FAMILIES)) {
        for (const host of knownHosts) {
          expect(seen.has(host)).toBeFalse();
          seen.add(host);
        }
      }
    });
  });
});
