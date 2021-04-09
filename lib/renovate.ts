#!/usr/bin/env node

import { logger } from './logger';
import * as proxy from './proxy';
import * as globalWorker from './workers/global';

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
});

proxy.bootstrap();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
  process.exitCode = await globalWorker.start();
  // istanbul ignore if
  if (process.env.RENOVATE_X_HARD_EXIT) {
    process.exit(process.exitCode);
  }
})();
