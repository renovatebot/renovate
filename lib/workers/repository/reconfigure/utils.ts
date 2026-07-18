import { isNonEmptyString } from '@sindresorhus/is';
import type { RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import { scm } from '../../../modules/platform/scm.ts';
import type { BranchStatus } from '../../../types/index.ts';
import { parseJson } from '../../../util/common.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { detectConfigFile } from '../init/merge.ts';

export function getReconfigureBranchName(prefix: string): string {
  return `${prefix}reconfigure`;
}

export async function setBranchStatus(
  branchName: string,
  description: string,
  state: BranchStatus,
  context?: string | null,
): Promise<void> {
  if (!isNonEmptyString(context)) {
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

type GetReconfigureConfigResult =
  | { ok: true; config: RenovateConfig; configFileName: string }
  | { ok: false; errMessage: string; configFileName?: string };

export async function getReconfigureConfig(
  branchName: string,
): Promise<GetReconfigureConfigResult> {
  await scm.checkoutBranch(branchName);
  const configFileName = await detectConfigFile();

  if (configFileName === null) {
    logger.debug('No config file found in reconfigure branch');
    return {
      ok: false,
      errMessage: 'Validation Failed - No config file found',
    };
  }

  const configFileRaw = await readLocalFile(configFileName, 'utf8');
  if (configFileRaw === null) {
    return {
      ok: false,
      errMessage: 'Validation Failed - Invalid config file',
      configFileName,
    };
  }

  let configFileParsed: RenovateConfig | undefined;
  try {
    const parsed = parseJson(
      configFileRaw,
      configFileName,
    ) as RenovateConfig & {
      renovate?: RenovateConfig;
    };
    // no need to confirm renovate field in package.json we already do it in `detectConfigFile()`
    configFileParsed =
      configFileName === 'package.json' ? parsed.renovate : parsed;
  } catch (err) {
    logger.debug({ err }, 'Error while parsing config file');
    return {
      ok: false,
      errMessage: 'Validation Failed - Unparsable config file',
      configFileName,
    };
  }

  // package.json presence of the renovate field is guaranteed by detectConfigFile()
  return { ok: true, config: configFileParsed!, configFileName };
}
