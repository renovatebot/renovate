#!/usr/bin/env node

import 'source-map-support/register.js';
import './punycode.cjs';

void (async (): Promise<void> => {
  // ⚠️ Don't add code before this!
  // This has to be imported before logger and other libraries which are instrumented.
  const otel = await import('./instrumentation/index.ts');
  otel.init();
  (await import('./proxy.ts')).bootstrap();

  // prints and exits the process if --version or --help is passed
  const { parseEarlyFlags } =
    await import('./workers/global/config/parse/cli.ts');
  parseEarlyFlags();

  const logger = await import('./logger/index.ts');
  /* v8 ignore next -- not easily testable */
  process.on('unhandledRejection', (err) => {
    logger.logger.error({ err }, 'unhandledRejection');
  });
  await logger.init();

  const { start } = await import('./workers/global/index.ts');
  process.exitCode = await otel.instrument('run', start);
  await otel.shutdown(); //gracefully shutdown OpenTelemetry

  /* v8 ignore if -- no test required */
  if (process.env.RENOVATE_X_HARD_EXIT) {
    process.exit(process.exitCode);
  }
})();
