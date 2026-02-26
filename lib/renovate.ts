#!/usr/bin/env node

import 'source-map-support/register.js';
import './punycode.cjs';

void (async (): Promise<void> => {
  // has to be imported before logger and other libraries which are instrumentalised
  const otel = await import('./instrumentation/index.ts');
  otel.init();
  (await import('./proxy.ts')).bootstrap();

  const logger = await import('./logger/index.ts');
  // TODO: consider removal ?
  /* v8 ignore next 3 -- not easily testable */
  process.on('unhandledRejection', (err) => {
    logger.logger.error({ err }, 'unhandledRejection');
  });
  await logger.init();

  const { start } = await import('./workers/global/index.ts');
  process.exitCode = await otel.instrument('run', start);
  await otel.shutdown(); //gracefully shutdown OpenTelemetry

  /* v8 ignore next 3 -- no test required */
  if (process.env.RENOVATE_X_HARD_EXIT) {
    process.exit(process.exitCode);
  }
})();
