import { ERROR } from 'bunyan';
import { getProblems, logger } from '../lib/logger';
import { generateSchema } from './docs/schema';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    const dist = '.';

    // json-schema
    logger.info('Generating json-schema');
    await generateSchema(dist);
    await generateSchema(dist, {
      filename: 'renovate-global-schema.json',
      isGlobal: true,
    });
  } catch (err) {
    logger.error({ err }, 'Unexpected error');
  } finally {
    const loggerErrors = getProblems().filter((p) => p.level >= ERROR);
    if (loggerErrors.length) {
      process.exit(1);
    }
  }
})();
