import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../constants/platforms';
import { id as GH_RELEASES_DS } from '../datasource/github-releases';
import { id as GH_TAGS_DS } from '../datasource/github-tags';
import { id as POD_DS } from '../datasource/pod';
import { GITHUB_API_USING_HOST_TYPES } from './github';

describe('types/github', () => {
  it('should be part of the GITHUB_API_USING_HOST_TYPES ', () => {
    expect(GITHUB_API_USING_HOST_TYPES.includes(GH_TAGS_DS)).toBeTrue();
    expect(GITHUB_API_USING_HOST_TYPES.includes(GH_RELEASES_DS)).toBeTrue();
    expect(GITHUB_API_USING_HOST_TYPES.includes(POD_DS)).toBeTrue();
    expect(
      GITHUB_API_USING_HOST_TYPES.includes(PLATFORM_TYPE_GITHUB)
    ).toBeTrue();
  });

  it('should be not part of the GITHUB_API_USING_HOST_TYPES ', () => {
    expect(
      GITHUB_API_USING_HOST_TYPES.includes(PLATFORM_TYPE_GITLAB)
    ).toBeFalse();
  });
});
