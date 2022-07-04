import { logger } from '../../logger';
import { rawSpawn } from './common';
// import { rawExec } from './common';
import type { RawSpawnOptions } from './types';

void (async () => {
  const cmds: [string, RawSpawnOptions][] = [];
  const opts: RawSpawnOptions = {
    encoding: 'utf8',
    shell: true,
    timeout: 2000,
  };
  logger.info('driver function - START');
  cmds.push(['npm run non-existent-script', opts]);
  cmds.push(['docker', { ...opts, shell: false }]);
  cmds.push(['docker image rm alpine', { ...opts, timeout: 0 }]);
  cmds.push(['docker images', opts]);
  cmds.push(['docker pull alpine', { ...opts, timeout: 0 }]);
  cmds.push(['docker images', opts]);
  cmds.push(['npm run spawn-testing-script', opts]);
  cmds.push(['npm run spawn-testing-script', { ...opts, shell: false }]);
  cmds.push(['sleep 900', opts]);
  cmds.push(['sleep 900', { ...opts, shell: false }]);
  cmds.push(['sleep 900', { ...opts, shell: '/bin/bash' }]);
  cmds.push(['ls -l /', { ...opts, timeout: 0, maxBuffer: 100 }]);
  cmds.push(['ps -auxf', opts]);

  for (const [cmd, opts] of cmds) {
    logger.info('-------------------------------------------------------');
    logger.info({ opts }, `Run rawSpawn() - START - "${cmd}"`);
    try {
      const { stdout, stderr } = await rawSpawn(cmd, opts);
      // const { stdout, stderr } = await rawExec(cmd, {encoding: 'utf8', timeout: 0});
      if (stdout) {
        logger.info(stdout);
      }
      if (stderr) {
        logger.warn(stderr);
      }
    } catch (err) {
      logger.error(err as string);
    }
    logger.info(`run cmd - END - "${cmd}"`);
  }
  logger.info('driver function - END');
})();
