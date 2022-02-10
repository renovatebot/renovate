import { BitBucketTagsDatasource } from '../datasource/bitbucket-tags';
import { id as GH_RELEASES_DS } from '../datasource/github-releases';
import { id as GH_TAGS_DS } from '../datasource/github-tags';
import { GitlabPackagesDatasource } from '../datasource/gitlab-packages';
import { GitlabReleasesDatasource } from '../datasource/gitlab-releases';
import { id as GL_TAGS_DS } from '../datasource/gitlab-tags';
import { PodDatasource } from '../datasource/pod';
import { id as GITHUB_CHANGELOG_ID } from '../workers/pr/changelog/github';
import { id as GITLAB_CHANGELOG_ID } from '../workers/pr/changelog/gitlab';
import {
  BITBUCKET_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
  PlatformId,
} from './platforms';

describe('constants/platform', () => {
  it('should be part of the GITLAB_API_USING_HOST_TYPES', () => {
    expect(GITLAB_API_USING_HOST_TYPES.includes(GL_TAGS_DS)).toBeTrue();
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(GitlabReleasesDatasource.id)
    ).toBeTrue();
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(GitlabPackagesDatasource.id)
    ).toBeTrue();
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(GITLAB_CHANGELOG_ID)
    ).toBeTrue();
    expect(GITLAB_API_USING_HOST_TYPES.includes(PlatformId.Gitlab)).toBeTrue();
  });

  it('should be not part of the GITLAB_API_USING_HOST_TYPES ', () => {
    expect(GITLAB_API_USING_HOST_TYPES.includes(PlatformId.Github)).toBeFalse();
  });

  it('should be part of the GITHUB_API_USING_HOST_TYPES ', () => {
    expect(GITHUB_API_USING_HOST_TYPES.includes(GH_TAGS_DS)).toBeTrue();
    expect(GITHUB_API_USING_HOST_TYPES.includes(GH_RELEASES_DS)).toBeTrue();
    expect(GITHUB_API_USING_HOST_TYPES.includes(PodDatasource.id)).toBeTrue();
    expect(
      GITHUB_API_USING_HOST_TYPES.includes(GITHUB_CHANGELOG_ID)
    ).toBeTrue();
    expect(GITHUB_API_USING_HOST_TYPES.includes(PlatformId.Github)).toBeTrue();
  });

  it('should be not part of the GITHUB_API_USING_HOST_TYPES ', () => {
    expect(GITHUB_API_USING_HOST_TYPES.includes(PlatformId.Gitlab)).toBeFalse();
  });

  it('should be part of the BITBUCKET_API_USING_HOST_TYPES ', () => {
    expect(
      BITBUCKET_API_USING_HOST_TYPES.includes(BitBucketTagsDatasource.id)
    ).toBeTrue();
    expect(
      BITBUCKET_API_USING_HOST_TYPES.includes(PlatformId.Bitbucket)
    ).toBeTrue();
  });
});
