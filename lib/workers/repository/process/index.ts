// TODO #22198
import { GlobalConfig } from '../../../config/global.ts';
import { mergeChildConfig } from '../../../config/index.ts';
import { migrateAndValidate } from '../../../config/migrate-validate.ts';
import { parseFileConfig } from '../../../config/parse.ts';
import { resolveConfigPresets } from '../../../config/presets/index.ts';
import type { RenovateConfig } from '../../../config/types.ts';
import {
  CONFIG_VALIDATION,
  PlatformErrors,
  TemporaryErrors,
} from '../../../constants/error-messages.ts';
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
import { isNotFound } from '../../../util/http/status.ts';
import { addSplit } from '../../../util/split.ts';
import { getRegexPredicate } from '../../../util/string-match.ts';
import type { BranchConfig } from '../../types.ts';
import { readDashboardBody } from '../dependency-dashboard.ts';
import type { RepoConfig } from '../init/defaults.ts';
import type { ExtractResult } from './extract-update.ts';
import { extract, lookup, update } from './extract-update.ts';
import type { WriteUpdateResult } from './write.ts';

function isPlatformOrTemporaryError(message: unknown): boolean {
  return (
    (PlatformErrors as readonly unknown[]).includes(message) ||
    (TemporaryErrors as readonly unknown[]).includes(message)
  );
}

/**
 * Reads, validates and merges the config file from `baseBranch` over the default branch's config.
 *
 * Returns `null` when `useBaseBranchConfig=merge-if-present` and the config file does not exist on `baseBranch`, so the default branch's config is used.
 */
async function readBaseBranchConfig(
  baseBranch: string,
  config: RenovateConfig,
): Promise<RenovateConfig | null> {
  const mode = config.useBaseBranchConfig;
  logger.debug(
    { baseBranch },
    `Reading config from base branch because useBaseBranchConfig=${mode}`,
  );

  // Retrieve config file name autodetected for this repo
  const cache = getCache();
  // TODO: types (#22198)
  const configFileName = cache.configFileName!;

  const hasConfigFile = !!configFileName && configFileName !== 'package.json';
  if (mode === 'merge-if-present' && !hasConfigFile) {
    logger.debug(
      { baseBranch, configFileName },
      'Cannot read branch-specific config without a dedicated config file, using default branch config',
    );
    return null;
  }

  let configFileRaw: string | null = null;
  let fetchError: Error | undefined;
  try {
    configFileRaw = await platform.getRawFile(
      configFileName,
      config.repository,
      baseBranch,
    );
  } catch (err) {
    if (
      err instanceof ExternalHostError ||
      isPlatformOrTemporaryError(err.message)
    ) {
      throw err;
    }

    if (!isNotFound(err)) {
      fetchError = err;
    }
  }

  if (configFileRaw === null) {
    if (fetchError) {
      logger.error(
        { configFileName, baseBranch, err: fetchError },
        'Error fetching config file from base branch',
      );
    } else if (mode === 'merge-if-present') {
      logger.debug(
        { baseBranch, configFileName },
        'No branch-specific config file found, falling back to default branch config',
      );
      return null;
    } else {
      logger.error(
        { configFileName, baseBranch },
        `Config file not found on base branch - possible config name mismatch between branches?`,
      );
    }

    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = 'config';
    error.validationError = 'Error fetching config file';
    error.validationMessage = `Error fetching config file \`${configFileName}\` from branch \`${baseBranch}\``;
    throw error;
  }

  const parseResult = parseFileConfig(
    configFileName,
    configFileRaw.length ? configFileRaw : '{}',
  );
  if (!parseResult.success) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = configFileName;
    error.validationError = `The renovate configuration file of branch ${baseBranch} could not be parsed: ${parseResult.validationError}`;
    error.validationMessage = parseResult.validationMessage;
    throw error;
  }
  const rawBranchConfig = parseResult.parsedContents as RenovateConfig;
  logger.debug({ config: rawBranchConfig }, 'Base branch config raw');

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

  const { config: resolvedConfig } = await resolveConfigPresets(
    migratedConfig,
    config,
  );
  const result = mergeChildConfig(config, resolvedConfig);
  // baseBranches value should be based off the default branch
  result.baseBranchPatterns = config.baseBranchPatterns;
  result.baseBranches = config.baseBranches;
  /* v8 ignore if -- TODO: add test #40625 */
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

  const usesBaseBranchConfig =
    config.useBaseBranchConfig === 'merge' ||
    config.useBaseBranchConfig === 'merge-if-present';
  if (usesBaseBranchConfig && baseBranch !== config.defaultBranch) {
    const branchConfig = await readBaseBranchConfig(baseBranch, config);
    if (branchConfig) {
      baseBranchConfig = branchConfig;
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
        `baseBranchPatterns regex "${baseBranchPattern}" matches [${matchingBranches.join()}]`,
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
  config: RepoConfig,
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
): Promise<WriteUpdateResult> {
  logger.debug('processRepo()');

  return update(config, branches);
}
