#!/usr/bin/env node

import { instrument, shutdown as telemetryShutdown } from './instrumentation'; // has to be imported before logger and other libraries which are instrumentalised
import { logger } from './logger';
import * as proxy from './proxy';
import * as globalWorker from './workers/global';

// istanbul ignore next
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'unhandledRejection');
});

proxy.bootstrap();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
  process.exitCode = await instrument('run', () => globalWorker.start());
  await telemetryShutdown(); //gracefully shutdown OpenTelemetry

  // istanbul ignore if
  if (process.env.RENOVATE_X_HARD_EXIT) {
    process.exit(process.exitCode);
  }
})();
