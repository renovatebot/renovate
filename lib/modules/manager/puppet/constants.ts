import { regEx } from '../../../util/regex';

export const RE_REPOSITORY_GITHUB_SSH_FORMAT = regEx(
  /(?:git@)github.com:([^/]+)\/([^/.]+)(?:\.git)?/
);
