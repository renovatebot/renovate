import { CONFIG_VALIDATION } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import type { FileChange } from './types';

// istanbul ignore next
export function checkForPlatformFailure(err: Error): Error | null {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  const externalHostFailureStrings = [
    'remote: Invalid username or password',
    'gnutls_handshake() failed',
    'The requested URL returned error: 403',
    'The requested URL returned error: 5',
    'The remote end hung up unexpectedly',
    'access denied or repository not exported',
    'Could not write new index file',
    'Failed to connect to',
    'Connection timed out',
    'malformed object name',
    'Could not resolve host',
    'early EOF',
    'fatal: bad config', // .gitmodules problem
    'expected flush after ref listing',
  ];
  for (const errorStr of externalHostFailureStrings) {
    if (err.message.includes(errorStr)) {
      logger.debug({ err }, 'Converting git error to ExternalHostError');
      return new ExternalHostError(err, 'git');
    }
  }

  const configErrorStrings = [
    {
      error: 'GitLab: Branch name does not follow the pattern',
      message:
        "Cannot push because branch name does not follow project's push rules",
    },
    {
      error: 'GitLab: Commit message does not follow the pattern',
      message:
        "Cannot push because commit message does not follow project's push rules",
    },
    {
      error: ' is not a member of team',
      message:
        'The `Restrict commits to existing GitLab users` rule is blocking Renovate push. Check the Renovate `gitAuthor` setting',
    },
    {
      error: 'TF401027:',
      message:
        'You need the Git `GenericContribute` permission to perform this action',
    },
    {
      error: 'matches more than one',
      message:
        "Renovate cannot push branches if there are tags with names the same as Renovate's branches. Please remove conflicting tag names or change Renovate's branchPrefix to avoid conflicts.",
    },
  ];
  for (const { error, message } of configErrorStrings) {
    if (err.message.includes(error)) {
      logger.debug({ err }, 'Converting git error to CONFIG_VALIDATION error');
      const res = new Error(CONFIG_VALIDATION);
      res.validationError = message;
      res.validationMessage = `\`${err.message.replaceAll('`', "'")}\``;
      return res;
    }
  }

  return null;
}

// istanbul ignore next
export function handleCommitError(
  err: Error,
  branchName: string,
  files?: FileChange[],
): null {
  checkForPlatformFailure(err);
  if (err.message.includes(`'refs/heads/renovate' exists`)) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = 'None';
    error.validationError = 'An existing branch is blocking Renovate';
    error.validationMessage = `Renovate needs to create the branch \`${branchName}\` but is blocked from doing so because of an existing branch called \`renovate\`. Please remove it so that Renovate can proceed.`;
    throw error;
  }
  if (
    err.message.includes(
      'refusing to allow a GitHub App to create or update workflow',
    )
  ) {
    logger.warn(
      'App has not been granted permissions to update Workflows - aborting branch.',
    );
    return null;
  }
  if (
    (err.message.includes('remote rejected') || err.message.includes('403')) &&
    files?.some((file) => file.path?.startsWith('.github/workflows/'))
  ) {
    logger.debug({ err }, 'commitFiles error');
    logger.info('Workflows update rejection - aborting branch.');
    return null;
  }
  if (err.message.includes('protected branch hook declined')) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = branchName;
    error.validationError = 'Renovate branch is protected';
    error.validationMessage = `Renovate cannot push to its branch because branch protection has been enabled.`;
    throw error;
  }
  if (err.message.includes('can only push your own commits')) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = branchName;
    error.validationError = 'Bitbucket committer error';
    error.validationMessage = `Renovate has experienced the following error when attempting to push its branch to the server: \`${err.message.replaceAll(
      '`',
      "'",
    )}\``;
    throw error;
  }
  if (err.message.includes('remote: error: cannot lock ref')) {
    logger.error({ err }, 'Error committing files.');
    return null;
  }
  if (
    err.message.includes('denying non-fast-forward') ||
    err.message.includes('GH003: Sorry, force-pushing')
  ) {
    logger.debug({ err }, 'Permission denied to update branch');
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = branchName;
    error.validationError = 'Force push denied';
    error.validationMessage = `Renovate is unable to update branch(es) due to force pushes being disallowed.`;
    throw error;
  }
  logger.debug({ err }, 'Unknown error committing files');
  // We don't know why this happened, so this will cause bubble up to a branch error
  throw err;
}

export function bulkChangesDisallowed(err: Error): boolean {
  return err.message.includes('update more than');
}
