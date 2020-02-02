#!/usr/bin/env node

import * as fs from 'fs-extra';
import * as proxy from './proxy';
import * as globalWorker from './workers/global';
import * as datasource from './datasource';
import { platform } from './platform';
import { logger, setMeta } from './logger';

import { extractAllDependencies } from './workers/repository/extract';
import handleError from './workers/repository/error';
import { initRepo } from './workers/repository/init';
import { processResult, ProcessResult } from './workers/repository/result';

const worker = {
  renovateRepository: async (repoConfig): Promise<ProcessResult> => {
    let config = { ...repoConfig };
    setMeta({ repository: config.repository });
    logger.info('Renovating repository');
    logger.trace({ config });
    let repoResult;
    try {
      await fs.ensureDir(config.localDir);
      logger.debug('Using localDir: ' + config.localDir);
      config = await initRepo(config);
      const packageFiles = await extractAllDependencies(config);
      for (const [manager, files] of Object.entries(packageFiles)) {
        for (const packageFile of files) {
          for (const dep of packageFile.deps) {
            const { license, licenseUrl } = await datasource.getPkgReleases(
              dep
            );
            if (license || licenseUrl) {
              logger.info(
                `${config.repository} -> ${manager}:${dep.depName}: ${license} ${licenseUrl}`
              );
            }
          }
        }
      }
      return repoResult;
    } catch (err) /* istanbul ignore next */ {
      const errorRes = await handleError(config, err);
      repoResult = processResult(config, errorRes);
    }
    await platform.cleanRepo();
    if (config.localDir && !config.persistRepoData) {
      await fs.remove(config.localDir);
    }
    logger.info('Finished repository');
    return repoResult;
  },
};

proxy.bootstrap();

(async (): Promise<void> => {
  process.exitCode = await globalWorker.start(worker);
})();
