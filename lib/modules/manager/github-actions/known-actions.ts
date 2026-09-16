import { crateDynamicActions } from './known-actions/crate-dynamic.ts';
import { dartVersionActions } from './known-actions/dart-version.ts';
import { dockerActions } from './known-actions/docker.ts';
import { dockerDynamicActions } from './known-actions/docker-dynamic.ts';
import { dotnetVersionActions } from './known-actions/dotnet-version.ts';
import { githubReleaseAttachmentsDynamicActions } from './known-actions/github-release-attachments-dynamic.ts';
import { githubReleasesActions } from './known-actions/github-releases.ts';
import { githubReleasesDynamicActions } from './known-actions/github-releases-dynamic.ts';
import { gradleVersionActions } from './known-actions/gradle-version.ts';
import { javaVersionDynamicActions } from './known-actions/java-version-dynamic.ts';
import { multipleActions } from './known-actions/multiple.ts';
import { npmActions } from './known-actions/npm.ts';
import { pypiActions } from './known-actions/pypi.ts';
import { rubyVersionActions } from './known-actions/ruby-version.ts';
import { rustVersionActions } from './known-actions/rust-version.ts';
import { rustVersionDynamicActions } from './known-actions/rust-version-dynamic.ts';
import type { KnownActionConfig } from './types.ts';

export { actionSchema } from './known-actions/utils.ts';

/**
 * Community-maintained and first-party (GitHub's own `actions/*`) Actions
 * with known version input schemas.
 */
export const knownActions: Record<string, KnownActionConfig> = {
  ...dockerActions,
  ...dockerDynamicActions,
  ...dartVersionActions,
  ...dotnetVersionActions,
  ...githubReleasesActions,
  ...githubReleasesDynamicActions,
  ...githubReleaseAttachmentsDynamicActions,
  ...gradleVersionActions,
  ...javaVersionDynamicActions,
  ...npmActions,
  ...pypiActions,
  ...rubyVersionActions,
  ...rustVersionActions,
  ...rustVersionDynamicActions,
  ...crateDynamicActions,
  ...multipleActions,
};
