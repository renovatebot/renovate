#!/usr/bin/env node

import 'source-map-support/register';
import './punycode.cjs';
import { instrument, shutdown as telemetryShutdown } from './instrumentation'; // has to be imported before logger and other libraries which are instrumentalised
import { logger } from './logger';
import { bootstrap } from './proxy';
import { start } from './workers/global';

/* v8 ignore next 3 -- not easily testable */
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'unhandledRejection');
});

bootstrap();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
  process.exitCode = await instrument('run', () => start());
  await telemetryShutdown(); //gracefully shutdown OpenTelemetry

  /* v8 ignore next 3 -- no test required */
  if (process.env.RENOVATE_X_HARD_EXIT) {
    process.exit(process.exitCode);
  }
})();
