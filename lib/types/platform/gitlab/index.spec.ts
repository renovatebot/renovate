import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../../constants/platforms';
import { GitlabReleasesDatasource } from '../../../datasource/gitlab-releases';
import { id as GL_TAGS_DS } from '../../../datasource/gitlab-tags';
import { GITLAB_API_USING_HOST_TYPES } from './index';

describe('types/platform/gitlab/index', () => {
  it('should be part of the GITLAB_API_USING_HOST_TYPES', () => {
    expect(GITLAB_API_USING_HOST_TYPES.includes(GL_TAGS_DS)).toBeTrue();
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(GitlabReleasesDatasource.id)
    ).toBeTrue();
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(PLATFORM_TYPE_GITLAB)
    ).toBeTrue();
  });

  it('should be not part of the GITLAB_API_USING_HOST_TYPES ', () => {
    expect(
      GITLAB_API_USING_HOST_TYPES.includes(PLATFORM_TYPE_GITHUB)
    ).toBeFalse();
  });
});
