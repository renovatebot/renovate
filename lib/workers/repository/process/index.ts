// TODO #22198
import { mergeChildConfig } from '../../../config';
import { configFileNames } from '../../../config/app-strings';
import { GlobalConfig } from '../../../config/global';
import { resolveConfigPresets } from '../../../config/presets';
import type { RenovateConfig } from '../../../config/types';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { addMeta, logger, removeMeta } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';
import { platform } from '../../../modules/platform';
import { scm } from '../../../modules/platform/scm';
import { getCache } from '../../../util/cache/repository';
import { clone } from '../../../util/clone';
import { getEnv } from '../../../util/env';
import { getBranchList } from '../../../util/git';
import { addSplit } from '../../../util/split';
import { getRegexPredicate } from '../../../util/string-match';
import { parseConfigsUsingFile } from '../../global/config/parse';
import type { BranchConfig } from '../../types';
import { readDashboardBody } from '../dependency-dashboard';
import { initializeConfig } from '../init';
import { detectVulnerabilityAlerts } from '../init/vulnerability';
import type { ExtractResult } from './extract-update';
import { extract, lookup, update } from './extract-update';
import type { WriteUpdateResult } from './write';

async function getBaseBranchConfig(
  baseBranch: string,
  config: RenovateConfig,
): Promise<RenovateConfig> {
  logger.debug(`baseBranch: ${baseBranch}`);

  let baseBranchConfig: RenovateConfig = clone(config);

  if (
    config.useBaseBranchConfig !== 'none' &&
    baseBranch !== config.defaultBranch
  ) {
    logger.debug(
      { baseBranch },
      config.useBaseBranchConfig === 'merge'
        ? `Merging config from base branch because useBaseBranchConfig=merge`
        : `Replacing config with config from base branch because useBaseBranchConfig=${config.useBaseBranchConfig}`,
    );

    baseBranchConfig = await getConfigFromBaseBranch(baseBranch, config);
    baseBranchConfig = await resolveConfigPresets(baseBranchConfig, config);

    switch (config.useBaseBranchConfig) {
      case 'merge':
        baseBranchConfig = mergeChildConfig(config, baseBranchConfig);
        break;

      case 'replace':
        // Although we are replacing the config with the one from the
        // base branch, we can't use the base branch config as is.
        // We need to apply the defaults, environment and command
        // line arguments to it, in the same way that they were
        // applied to the config from the default branch.
        baseBranchConfig = await parseConfigsUsingFile(
          getEnv(),
          process.argv,
          baseBranchConfig,
        );

        // Once the default configuration has been created,
        // there are some additional changes applied to it.
        baseBranchConfig = initializeConfig(baseBranchConfig);
        baseBranchConfig = await detectVulnerabilityAlerts(baseBranchConfig);
        break;
    }

    // istanbul ignore if
    if (config.printConfig) {
      logger.info(
        { config: baseBranchConfig },
        'Base branch config after ' + config.useBaseBranchConfig,
      );
    }

    // baseBranches value should be based off the default branch
    baseBranchConfig.baseBranches = config.baseBranches;
  }

  if (config.baseBranches!.length > 1) {
    baseBranchConfig.branchPrefix += `${baseBranch}-`;
    baseBranchConfig.hasBaseBranches = true;
  }

  baseBranchConfig = mergeChildConfig(baseBranchConfig, { baseBranch });

  return baseBranchConfig;
}

function unfoldBaseBranches(
  defaultBranch: string,
  baseBranches: string[],
): string[] {
  const unfoldedList: string[] = [];

  const allBranches = getBranchList();
  for (const baseBranch of baseBranches) {
    const isAllowedPred = getRegexPredicate(baseBranch);
    if (isAllowedPred) {
      const matchingBranches = allBranches.filter(isAllowedPred);
      logger.debug(
        `baseBranches regex "${baseBranch}" matches [${matchingBranches.join()}]`,
      );
      unfoldedList.push(...matchingBranches);
    } else if (baseBranch === '$default') {
      logger.debug(`baseBranches "$default" matches "${defaultBranch}"`);
      unfoldedList.push(defaultBranch);
    } else {
      unfoldedList.push(baseBranch);
    }
  }

  return [...new Set(unfoldedList)];
}

async function getConfigFromBaseBranch(
  baseBranch: string,
  config: RenovateConfig,
): Promise<RenovateConfig> {
  // Retrieve config file name autodetected for this repo
  const cache = getCache();
  // TODO: types (#22198)
  const defaultBranchConfigFileName = cache.configFileName!;

  // If we are allowed to detect the config file on the base branch,
  // then we will start by trying each possible config file name.
  let fileNamesToTry: string[] = [];
  if (config.detectBaseBranchConfigFileName) {
    fileNamesToTry.push(...configFileNames);
  }

  // If the config file name from the default branch is not one
  // that we are already going to try, then we'll try it last.
  if (!fileNamesToTry.includes(defaultBranchConfigFileName)) {
    fileNamesToTry.push(defaultBranchConfigFileName);
  }

  // Reading the config from `package.json`
  // is not supported for base branches.
  fileNamesToTry = fileNamesToTry.filter((x) => x !== 'package.json');

  for (const fileName of fileNamesToTry) {
    logger.debug({ baseBranch, fileName }, 'detecting base branch config');
    try {
      const baseBranchConfig = await platform.getJsonFile(
        fileName,
        config.repository,
        baseBranch,
      );
      logger.debug(
        { config: baseBranchConfig, fileName },
        'Base branch config raw',
      );
      return baseBranchConfig;
    } catch {
      // A config file with this name does
      // not exist. Try the next file name.
    }
  }

  logger.error(
    { defaultBranchConfigFileName, baseBranch },
    `Error fetching config file from base branch - possible config name mismatch between branches?`,
  );

  const error = new Error(CONFIG_VALIDATION);
  error.validationSource = 'config';
  error.validationError = 'Error fetching config file';
  error.validationMessage = `Error fetching config file \`${defaultBranchConfigFileName}\` from branch \`${baseBranch}\``;
  throw error;
}

export async function extractDependencies(
  config: RenovateConfig,
  overwriteCache = true,
): Promise<ExtractResult> {
  await readDashboardBody(config);
  let res: ExtractResult = {
    branches: [],
    branchList: [],
    packageFiles: {},
  };
  if (GlobalConfig.get('platform') !== 'local' && config.baseBranches?.length) {
    config.baseBranches = unfoldBaseBranches(
      config.defaultBranch!,
      config.baseBranches,
    );
    logger.debug({ baseBranches: config.baseBranches }, 'baseBranches');
    const extracted: Record<string, Record<string, PackageFile[]>> = {};
    for (const baseBranch of config.baseBranches) {
      addMeta({ baseBranch });
      if (await scm.branchExists(baseBranch)) {
        const baseBranchConfig = await getBaseBranchConfig(baseBranch, config);
        extracted[baseBranch] = await extract(baseBranchConfig, overwriteCache);
      } else {
        logger.warn({ baseBranch }, 'Base branch does not exist - skipping');
      }
    }
    addSplit('extract');
    for (const baseBranch of config.baseBranches) {
      if (await scm.branchExists(baseBranch)) {
        addMeta({ baseBranch });
        const baseBranchConfig = await getBaseBranchConfig(baseBranch, config);
        const packageFiles = extracted[baseBranch];
        const baseBranchRes = await lookup(baseBranchConfig, packageFiles);
        res.branches = res.branches.concat(baseBranchRes?.branches);
        res.branchList = res.branchList.concat(baseBranchRes?.branchList);
        if (!res.packageFiles || !Object.keys(res.packageFiles).length) {
          // Use the first branch
          res.packageFiles = baseBranchRes?.packageFiles;
        }
      }
    }
    removeMeta(['baseBranch']);
  } else {
    logger.debug('No baseBranches');
    const packageFiles = await extract(config, overwriteCache);
    addSplit('extract');
    if (GlobalConfig.get('dryRun') === 'extract') {
      res.packageFiles = packageFiles;
      logger.info({ packageFiles }, 'Extracted dependencies');
      return res;
    }
    res = await lookup(config, packageFiles);
  }
  addSplit('lookup');
  return res;
}

export function updateRepo(
  config: RenovateConfig,
  branches: BranchConfig[],
): Promise<WriteUpdateResult | undefined> {
  logger.debug('processRepo()');

  return update(config, branches);
}
