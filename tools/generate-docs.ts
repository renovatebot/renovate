import { logger } from '../lib/logger';
import { generateDocs } from './docs';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

void generateDocs();
