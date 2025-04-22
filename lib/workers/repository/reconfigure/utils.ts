import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { scm } from '../../../modules/platform/scm';
import type { BranchStatus } from '../../../types';
import { parseJson } from '../../../util/common';
import { readLocalFile } from '../../../util/fs';
import { detectConfigFile } from '../init/merge';

export function getReconfigureBranchName(prefix: string): string {
  return `${prefix}reconfigure`;
}

export async function setBranchStatus(
  branchName: string,
  description: string,
  state: BranchStatus,
  context?: string | null,
): Promise<void> {
  if (!is.nonEmptyString(context)) {
    // already logged this case when validating the status check
    return;
  }

  await platform.setBranchStatus({
    branchName,
    context,
    description,
    state,
  });
}

export async function getReconfigureConfig(branchName: string): Promise<{
  config: RenovateConfig | null;
  errMessage?: string;
  configFileName?: string;
}> {
  let errMessage = undefined;

  await scm.checkoutBranch(branchName);
  const configFileName = await detectConfigFile();

  if (configFileName === null) {
    logger.debug('No config file found in reconfigure branch');
    errMessage = 'Validation Failed - No config file found';
    return { config: null, errMessage };
  }

  const configFileRaw = await readLocalFile(configFileName, 'utf8');
  if (configFileRaw === null) {
    errMessage = 'Validation Failed - Invalid config file';
    return { config: null, errMessage, configFileName };
  }

  let configFileParsed: any;
  try {
    configFileParsed = parseJson(configFileRaw, configFileName);
    // no need to confirm renovate field in package.json we already do it in `detectConfigFile()`
    if (configFileName === 'package.json') {
      configFileParsed = configFileParsed.renovate;
    }
  } catch (err) {
    logger.debug({ err }, 'Error while parsing config file');
    errMessage = 'Validation Failed - Unparsable config file';
    return { config: null, errMessage, configFileName };
  }

  return { config: configFileParsed, errMessage, configFileName };
}
