export const COMMIT_MESSAGE_PREFIX_SEPARATOR = ':';

export const formatCommitMessagePrefix = (
  commitMessagePrefix: string
): string =>
  `${commitMessagePrefix}${
    commitMessagePrefix.endsWith(COMMIT_MESSAGE_PREFIX_SEPARATOR)
      ? ''
      : COMMIT_MESSAGE_PREFIX_SEPARATOR
  }`;
