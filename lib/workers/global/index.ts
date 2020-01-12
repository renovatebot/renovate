import is from '@sindresorhus/is';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { setEmojiConfig } from '../../util/emoji';
import { logger, setMeta, getErrors } from '../../logger';
import * as configParser from '../../config';
import * as repositoryWorker from '../repository';
import * as cache from './cache';
import { autodiscoverRepositories } from './autodiscover';
import { initPlatform } from '../../platform';
import * as hostRules from '../../util/host-rules';
import { printStats } from '../../util/got/stats';
import * as limits from './limits';
import { setExecConfig } from '../../util/exec';

type RenovateConfig = configParser.RenovateConfig;
type RenovateRepository = configParser.RenovateRepository;

async function setDirectories(input: RenovateConfig): Promise<RenovateConfig> {
  const config: RenovateConfig = { ...input };
  process.env.TMPDIR = process.env.RENOVATE_TMPDIR || os.tmpdir();
  if (config.baseDir) {
    logger.debug('Using configured baseDir: ' + config.baseDir);
  } else {
    config.baseDir = path.join(process.env.TMPDIR, 'renovate');
    logger.debug('Using baseDir: ' + config.baseDir);
  }
  await fs.ensureDir(config.baseDir);
  if (config.cacheDir) {
    logger.debug('Using configured cacheDir: ' + config.cacheDir);
  } else {
    config.cacheDir = path.join(config.baseDir, 'cache');
    logger.debug('Using cacheDir: ' + config.cacheDir);
  }
  await fs.ensureDir(config.cacheDir);
  cache.init(config.cacheDir);
  return config;
}

export async function getRepositoryConfig(
  globalConfig: RenovateConfig,
  repository: RenovateRepository
): Promise<RenovateConfig> {
  const repoConfig = configParser.mergeChildConfig(
    globalConfig,
    is.string(repository) ? { repository } : repository
  );
  repoConfig.localDir = path.join(
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

export async function start(): Promise<0 | 1> {
  try {
    let config = await getGlobalConfig();
    config = await initPlatform(config);
    config = await setDirectories(config);
    setExecConfig(config);
    config = await autodiscoverRepositories(config);

    limits.init(config);
    setEmojiConfig(config);
    // Iterate through repositories sequentially
    for (const repository of config.repositories) {
      if (limits.getLimitRemaining('prCommitsPerRunLimit') <= 0) {
        logger.info(
          'Max commits created for this run. Skipping all remaining repositories.'
        );
        break;
      }
      const repoConfig = await getRepositoryConfig(config, repository);
      if (repoConfig.hostRules) {
        hostRules.clear();
        repoConfig.hostRules.forEach(rule => hostRules.add(rule));
        repoConfig.hostRules = [];
      }
      await repositoryWorker.renovateRepository(repoConfig);
    }
    setMeta({});
    printStats();
    logger.info(`Renovate finished`);
  } catch (err) /* istanbul ignore next */ {
    if (err.message.startsWith('Init: ')) {
      logger.fatal(err.message.substring(6));
    } else {
      logger.fatal({ err }, `Fatal error: ${err.message}`);
    }
  }
  const loggerErrors = getErrors();
  /* istanbul ignore if */
  if (loggerErrors.length) {
    logger.info(
      { loggerErrors },
      'Renovate is exiting with a non-zero code due to the following logged errors'
    );
    return 1;
  }
  return 0;
}
