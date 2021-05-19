import is from '@sindresorhus/is';
import { ERROR } from 'bunyan';
import fs from 'fs-extra';
import { satisfies } from 'semver';
import upath from 'upath';
import * as pkg from '../../../package.json';
import * as configParser from '../../config';
import { resolveConfigPresets } from '../../config/presets';
import { validateConfigSecrets } from '../../config/secrets';
import type {
  GlobalConfig,
  RenovateConfig,
  RenovateRepository,
} from '../../config/types';
import { CONFIG_PRESETS_INVALID } from '../../constants/error-messages';
import { getProblems, logger, setMeta } from '../../logger';
import { setUtilConfig } from '../../util';
import * as hostRules from '../../util/host-rules';
import * as repositoryWorker from '../repository';
import { autodiscoverRepositories } from './autodiscover';
import { globalFinalize, globalInitialize } from './initialize';
import { Limit, isLimitReached } from './limits';

export async function getRepositoryConfig(
  globalConfig: RenovateConfig,
  repository: RenovateRepository
): Promise<RenovateConfig> {
  const repoConfig = configParser.mergeChildConfig(
    globalConfig,
    is.string(repository) ? { repository } : repository
  );
  repoConfig.localDir = upath.join(
    repoConfig.baseDir,
    `./repos/${repoConfig.platform}/${repoConfig.repository}`
  );
  await fs.ensureDir(repoConfig.localDir);
  delete repoConfig.baseDir;
  return configParser.filterConfig(repoConfig, 'repository');
}

function getGlobalConfig(): Promise<RenovateConfig> {
  return configParser.parseConfigs(process.env, process.argv);
}

function haveReachedLimits(): boolean {
  if (isLimitReached(Limit.Commits)) {
    logger.info('Max commits created for this run.');
    return true;
  }
  return false;
}

/* istanbul ignore next */
function checkEnv(): void {
  const range = pkg.engines.node;
  const rangeNext = pkg['engines-next']?.node;
  if (process.release?.name !== 'node' || !process.versions?.node) {
    logger.warn(
      { release: process.release, versions: process.versions },
      'Unknown node environment detected.'
    );
  } else if (!satisfies(process.versions?.node, range)) {
    logger.error(
      { versions: process.versions, range },
      'Unsupported node environment detected. Please update your node version.'
    );
  } else if (rangeNext && !satisfies(process.versions?.node, rangeNext)) {
    logger.warn(
      { versions: process.versions },
      `Please upgrade the version of Node.js used to run Renovate to satisfy "${rangeNext}". Support for your current version will be removed in Renovate's next major release.`
    );
  }
}

export async function validatePresets(config: GlobalConfig): Promise<void> {
  try {
    await resolveConfigPresets(config);
  } catch (err) /* istanbul ignore next */ {
    throw new Error(CONFIG_PRESETS_INVALID);
  }
}

export async function start(): Promise<number> {
  let config: GlobalConfig;
  try {
    // read global config from file, env and cli args
    config = await getGlobalConfig();
    // initialize all submodules
    config = await globalInitialize(config);

    await validatePresets(config);

    checkEnv();

    // validate secrets. Will throw and abort if invalid
    validateConfigSecrets(config);

    // autodiscover repositories (needs to come after platform initialization)
    config = await autodiscoverRepositories(config);
    // Iterate through repositories sequentially
    for (const repository of config.repositories) {
      if (haveReachedLimits()) {
        break;
      }
      const repoConfig = await getRepositoryConfig(config, repository);
      await setUtilConfig(repoConfig);
      if (repoConfig.hostRules) {
        hostRules.clear();
        repoConfig.hostRules.forEach((rule) => hostRules.add(rule));
        repoConfig.hostRules = [];
      }
      await repositoryWorker.renovateRepository(repoConfig);
      setMeta({});
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.message.startsWith('Init: ')) {
      logger.fatal(err.message.substring(6));
    } else {
      logger.fatal({ err }, `Fatal error: ${String(err.message)}`);
    }
    if (!config) {
      // return early if we can't parse config options
      logger.debug(`Missing config`);
      return 2;
    }
  } finally {
    globalFinalize(config);
    logger.debug(`Renovate exiting`);
  }
  const loggerErrors = getProblems().filter((p) => p.level >= ERROR);
  if (loggerErrors.length) {
    logger.info(
      { loggerErrors },
      'Renovate is exiting with a non-zero code due to the following logged errors'
    );
    return 1;
  }
  return 0;
}
