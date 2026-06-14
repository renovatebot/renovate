// TODO #22198
import { GlobalConfig } from '../../../config/global.ts';
import { mergeChildConfig } from '../../../config/index.ts';
import { migrateAndValidate } from '../../../config/migrate-validate.ts';
import { resolveConfigPresets } from '../../../config/presets/index.ts';
import type { RenovateConfig } from '../../../config/types.ts';
import { CONFIG_VALIDATION } from '../../../constants/error-messages.ts';
import { instrument } from '../../../instrumentation/index.ts';
import { ATTR_RENOVATE_SPLIT } from '../../../instrumentation/types.ts';
import { addMeta, logger, removeMeta } from '../../../logger/index.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import { platform } from '../../../modules/platform/index.ts';
import { scm } from '../../../modules/platform/scm.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import { clone } from '../../../util/clone.ts';
import { getBranchList } from '../../../util/git/index.ts';
import { addSplit } from '../../../util/split.ts';
import { getRegexPredicate } from '../../../util/string-match.ts';
import type { BranchConfig } from '../../types.ts';
import { readDashboardBody } from '../dependency-dashboard.ts';
import type { ExtractResult } from './extract-update.ts';
import { extract, lookup, update } from './extract-update.ts';
import type { WriteUpdateResult } from './write.ts';

async function resolveAndMerge(
  config: RenovateConfig,
  rawBranchConfig: RenovateConfig,
  configFileName: string,
  baseBranch: string,
): Promise<RenovateConfig> {
  const migratedConfig = await migrateAndValidate(config, rawBranchConfig);
  if (migratedConfig.errors?.length) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = configFileName;
    error.validationError = `The renovate configuration file of branch ${baseBranch} contains some invalid settings`;
    error.validationMessage = migratedConfig.errors
      .map((e) => e.message)
      .join(', ');
    throw error;
  }
  let result: RenovateConfig;
  ({ config: result } = await resolveConfigPresets(migratedConfig, config));
  result = mergeChildConfig(config, result);
  result.baseBranchPatterns = config.baseBranchPatterns;
  result.baseBranches = config.baseBranches;
  /* v8 ignore next */
  if (config.printConfig) {
    logger.info({ config: result }, 'Base branch config after merge');
  }
  return result;
}

export async function getBaseBranchConfig(
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
    } catch {
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

    baseBranchConfig = await resolveAndMerge(
      config,
      baseBranchConfig,
      configFileName,
      baseBranch,
    );
  }

  if (
    config.useBaseBranchConfig === 'fallback' &&
    baseBranch !== config.defaultBranch
  ) {
    logger.debug(
      { baseBranch },
      'Attempting to read branch-specific config because useBaseBranchConfig=fallback',
    );

    const cache = getCache();
    const configFileName = cache.configFileName;

    if (configFileName && configFileName !== 'package.json') {
      let rawBranchConfig: RenovateConfig | null = null;
      try {
        rawBranchConfig = await platform.getJsonFile(
          configFileName,
          config.repository,
          baseBranch,
        );
      } catch (err) {
        if (err instanceof ExternalHostError) {
          throw err;
        }
        const error = new Error(CONFIG_VALIDATION);
        error.validationSource = configFileName;
        error.validationError = 'Error fetching config file';
        error.validationMessage = `Error fetching config file \`${configFileName}\` from branch \`${baseBranch}\``;
        throw error;
      }

      if (rawBranchConfig) {
        baseBranchConfig = await resolveAndMerge(
          config,
          rawBranchConfig,
          configFileName,
          baseBranch,
        );
        logger.debug({ baseBranch }, 'Applied branch-specific renovate config');
      }
    }
  }

  if (isMultiBaseBranch(config)) {
    baseBranchConfig.branchPrefix += `${baseBranch}-`;
    baseBranchConfig.hasBaseBranches = true;
  }

  baseBranchConfig = mergeChildConfig(baseBranchConfig, { baseBranch });

  return baseBranchConfig;
}

function unfoldBaseBranches(
  defaultBranch: string,
  baseBranchPatterns: string[],
): string[] {
  const unfoldedList: string[] = [];

  const allBranches = getBranchList();
  for (const baseBranchPattern of baseBranchPatterns) {
    const isAllowedPred = getRegexPredicate(baseBranchPattern);
    if (isAllowedPred) {
      const matchingBranches = allBranches.filter(isAllowedPred);
      logger.debug(
        `baseBranchePatterns regex "${baseBranchPattern}" matches [${matchingBranches.join()}]`,
      );
      unfoldedList.push(...matchingBranches);
    } else if (baseBranchPattern === '$default') {
      logger.debug(`baseBranchPatterns "$default" matches "${defaultBranch}"`);
      unfoldedList.push(defaultBranch);
    } else {
      unfoldedList.push(baseBranchPattern);
    }
  }

  return [...new Set(unfoldedList)];
}

export function isMultiBaseBranch(config: RenovateConfig): boolean {
  if (!config.baseBranchPatterns?.length) {
    return false;
  }

  return (
    config.baseBranchPatterns.length > 1 ||
    config.baseBranchPatterns[0].startsWith('/')
  );
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
  if (
    GlobalConfig.get('platform') !== 'local' &&
    config.baseBranchPatterns?.length
  ) {
    config.baseBranches = unfoldBaseBranches(
      config.defaultBranch!,
      config.baseBranchPatterns,
    );
    logger.debug({ baseBranches: config.baseBranches }, 'baseBranches');
    const extracted: Record<string, Record<string, PackageFile[]>> = {};
    await instrument(
      'extract',
      async () => {
        for (const baseBranch of config.baseBranches!) {
          addMeta({ baseBranch });

          if (scm.syncForkWithUpstream) {
            await scm.syncForkWithUpstream(baseBranch);
          }
          if (await scm.branchExists(baseBranch)) {
            const baseBranchConfig = await getBaseBranchConfig(
              baseBranch,
              config,
            );
            extracted[baseBranch] = await extract(
              baseBranchConfig,
              overwriteCache,
            );
          } else {
            logger.warn(
              { baseBranch },
              'Base branch does not exist - skipping',
            );
          }
        }
      },
      {
        attributes: {
          [ATTR_RENOVATE_SPLIT]: 'extract',
        },
      },
    );
    addSplit('extract');
    await instrument(
      'lookup',
      async () => {
        for (const baseBranch of config.baseBranches!) {
          if (await scm.branchExists(baseBranch)) {
            addMeta({ baseBranch });
            const baseBranchConfig = await getBaseBranchConfig(
              baseBranch,
              config,
            );
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
      },
      {
        attributes: {
          [ATTR_RENOVATE_SPLIT]: 'lookup',
        },
      },
    );
    removeMeta(['baseBranch']);
  } else {
    logger.debug('No baseBranches');
    const packageFiles = await instrument(
      'extract',
      async () => await extract(config, overwriteCache),
      {
        attributes: {
          [ATTR_RENOVATE_SPLIT]: 'extract',
        },
      },
    );
    addSplit('extract');
    if (GlobalConfig.get('dryRun') === 'extract') {
      res.packageFiles = packageFiles;
      logger.info({ packageFiles }, 'Extracted dependencies');
      return res;
    }
    res = await instrument(
      'lookup',
      async () => await lookup(config, packageFiles),
      {
        attributes: {
          [ATTR_RENOVATE_SPLIT]: 'lookup',
        },
      },
    );
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
