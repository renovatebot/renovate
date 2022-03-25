import { regEx } from '../../../util/regex';

export const RE_REPOSITORY_GENERIC_GIT_SSH_FORMAT =
  regEx(/^(?:git@[^:]*):(.+)$/);
