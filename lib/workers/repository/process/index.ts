// TODO #7154
import { mergeChildConfig } from '../../../config';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { addMeta, logger, removeMeta } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';
import { platform } from '../../../modules/platform';
import { getCache } from '../../../util/cache/repository';
import { clone } from '../../../util/clone';
import { branchExists } from '../../../util/git';
import { addSplit } from '../../../util/split';
import type { BranchConfig } from '../../types';
import { readDashboardBody } from '../dependency-dashboard';
import { ExtractResult, extract, lookup, update } from './extract-update';
import type { WriteUpdateResult } from './write';

async function getBaseBranchConfig(
  baseBranch: string,
  config: RenovateConfig
): Promise<RenovateConfig> {
  logger.debug(`baseBranch: ${baseBranch}`);

  let baseBranchConfig: RenovateConfig = clone(config);

  if (
    config.useBaseBranchConfig === 'merge' &&
    baseBranch !== config.defaultBranch
  ) {
    logger.debug(
      { baseBranch },
      `Merging config from base branch because useBaseBranchConfig=merge`
    );

    // Retrieve config file name autodetected for this repo
    const cache = getCache();
    // TODO: types (#7154)
    const configFileName = cache.configFileName!;

    try {
      baseBranchConfig = await platform.getJsonFile(
        configFileName,
        config.repository,
        baseBranch
      );
    } catch (err) {
      logger.error(
        { configFileName, baseBranch },
        `Error fetching config file from base branch - possible config name mismatch between branches?`
      );

      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'config';
      error.validationError = 'Error fetching config file';
      error.validationMessage = `Error fetching config file ${configFileName} from branch ${baseBranch}`;
      throw error;
    }

    baseBranchConfig = mergeChildConfig(config, baseBranchConfig);
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

export async function extractDependencies(
  config: RenovateConfig
): Promise<ExtractResult> {
  await readDashboardBody(config);
  let res: ExtractResult = {
    branches: [],
    branchList: [],
    packageFiles: null!,
  };
  if (config.baseBranches?.length) {
    logger.debug({ baseBranches: config.baseBranches }, 'baseBranches');
    const extracted: Record<string, Record<string, PackageFile[]>> = {};
    for (const baseBranch of config.baseBranches) {
      addMeta({ baseBranch });
      if (branchExists(baseBranch)) {
        const baseBranchConfig = await getBaseBranchConfig(baseBranch, config);
        extracted[baseBranch] = await extract(baseBranchConfig);
      } else {
        logger.warn({ baseBranch }, 'Base branch does not exist - skipping');
      }
    }
    addSplit('extract');
    for (const baseBranch of config.baseBranches) {
      if (branchExists(baseBranch)) {
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
  branches: BranchConfig[]
): Promise<WriteUpdateResult | undefined> {
  logger.debug('processRepo()');

  return update(config, branches);
}
