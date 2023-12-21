import { BitbucketTagsDatasource } from '../modules/datasource/bitbucket-tags';
import { GiteaTagsDatasource } from '../modules/datasource/gitea-tags';
import { GithubReleasesDatasource } from '../modules/datasource/github-releases';
import { GithubTagsDatasource } from '../modules/datasource/github-tags';
import { GitlabPackagesDatasource } from '../modules/datasource/gitlab-packages';
import { GitlabReleasesDatasource } from '../modules/datasource/gitlab-releases';
import { GitlabTagsDatasource } from '../modules/datasource/gitlab-tags';
import { HermitDatasource } from '../modules/datasource/hermit';
import { PodDatasource } from '../modules/datasource/pod';
import { id as GITHUB_CHANGELOG_ID } from '../workers/repository/update/pr/changelog/github';
import { id as GITLAB_CHANGELOG_ID } from '../workers/repository/update/pr/changelog/gitlab';
import {
  BITBUCKET_API_USING_HOST_TYPES,
  GITEA_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
} from './platforms';

describe('constants/platform', () => {
  it('should be part of the GITEA_API_USING_HOST_TYPES', () => {
    expect(
      GITEA_API_USING_HOST_TYPES.includes(GiteaTagsDatasource.id),
    ).toBeTrue();
    expect(GITEA_API_USING_HOST_TYPES.includes('gitea')).toBeTrue();
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

  it('should be not part of the GITLAB_API_USING_HOST_TYPES ', () => {
    expect(GITLAB_API_USING_HOST_TYPES.includes('github')).toBeFalse();
  });

  it('should be part of the GITHUB_API_USING_HOST_TYPES ', () => {
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

  it('should be not part of the GITHUB_API_USING_HOST_TYPES ', () => {
    expect(GITHUB_API_USING_HOST_TYPES.includes('gitlab')).toBeFalse();
  });

  it('should be part of the BITBUCKET_API_USING_HOST_TYPES ', () => {
    expect(
      BITBUCKET_API_USING_HOST_TYPES.includes(BitbucketTagsDatasource.id),
    ).toBeTrue();
    expect(BITBUCKET_API_USING_HOST_TYPES.includes('bitbucket')).toBeTrue();
  });
});
