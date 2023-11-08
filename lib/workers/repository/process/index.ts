// TODO #22198
import { mergeChildConfig } from '../../../config';
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
import { getBranchList } from '../../../util/git';
import { configRegexPredicate } from '../../../util/regex';
import { addSplit } from '../../../util/split';
import type { BranchConfig } from '../../types';
import { readDashboardBody } from '../dependency-dashboard';
import { ExtractResult, extract, lookup, update } from './extract-update';
import type { WriteUpdateResult } from './write';

async function getBaseBranchConfig(
  baseBranch: string,
  config: RenovateConfig,
): Promise<RenovateConfig> {
  logger.debug(`baseBranch: ${baseBranch}`);

  let baseBranchConfig: RenovateConfig = clone(config);

  if (
    config.useBaseBranchConfig === 'merge' &&
    baseBranch !== config.defaultBranch
  ) {
    logger.debug(
      { baseBranch },
      `Merging config from base branch because useBaseBranchConfig=merge`,
    );

    // Retrieve config file name autodetected for this repo
    const cache = getCache();
    // TODO: types (#22198)
    const configFileName = cache.configFileName!;

    try {
      baseBranchConfig = await platform.getJsonFile(
        configFileName,
        config.repository,
        baseBranch,
      );
      logger.debug({ config: baseBranchConfig }, 'Base branch config raw');
    } catch (err) {
      logger.error(
        { configFileName, baseBranch },
        `Error fetching config file from base branch - possible config name mismatch between branches?`,
      );

      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'config';
      error.validationError = 'Error fetching config file';
      error.validationMessage = `Error fetching config file \`${configFileName}\` from branch \`${baseBranch}\``;
      throw error;
    }

    baseBranchConfig = await resolveConfigPresets(baseBranchConfig, config);
    baseBranchConfig = mergeChildConfig(config, baseBranchConfig);

    // istanbul ignore if
    if (config.printConfig) {
      logger.info(
        { config: baseBranchConfig },
        'Base branch config after merge',
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
    const isAllowedPred = configRegexPredicate(baseBranch);
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

export async function extractDependencies(
  config: RenovateConfig,
): Promise<ExtractResult> {
  await readDashboardBody(config);
  let res: ExtractResult = {
    branches: [],
    branchList: [],
    packageFiles: null!,
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
        extracted[baseBranch] = await extract(baseBranchConfig);
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
        res.packageFiles = res.packageFiles || baseBranchRes?.packageFiles; // Use the first branch
      }
    }
    removeMeta(['baseBranch']);
  } else {
    logger.debug('No baseBranches');
    const packageFiles = await extract(config);
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
