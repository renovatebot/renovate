import { ERROR } from 'bunyan';
import shell from 'shelljs';
import { getProblems, logger } from '../lib/logger';
import { generateConfig } from './docs/config';
import { generateDatasources } from './docs/datasources';
import { generateManagers } from './docs/manager';
import { generateModules } from './docs/modules';
import { generatePlatforms } from './docs/platforms';
import { generatePresets } from './docs/presets';
import { generateSchema } from './docs/schema';
import { generateTemplates } from './docs/templates';
import { generateVersioning } from './docs/versioning';

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    const dist = 'tmp/docs';
    let r: shell.ShellString;

    logger.info('generating docs');

    r = shell.mkdir('-p', `${dist}/`);
    if (r.code) {
      return;
    }

    logger.info('* static');
    r = shell.cp('-r', 'docs/usage/*', `${dist}/`);
    if (r.code) {
      return;
    }

    logger.info('* modules');
    await generateModules(dist);

    logger.info('* platforms');
    await generatePlatforms(dist);

    // versionigs
    logger.info('* versionigs');
    await generateVersioning(dist);

    // datasources
    logger.info('* datasources');
    await generateDatasources(dist);

    // managers
    logger.info('* managers');
    await generateManagers(dist);

    // presets
    logger.info('* presets');
    await generatePresets(dist);

    // templates
    logger.info('* templates');
    await generateTemplates(dist);

    // configuration-options
    logger.info('* configuration-options');
    await generateConfig(dist);

    // self-hosted-configuration
    logger.info('* self-hosted-configuration');
    await generateConfig(dist, true);

    // json-schema
    logger.info('* json-schema');
    await generateSchema(dist);

    r = shell.exec('tar -czf ./tmp/docs.tgz -C ./tmp/docs .');
    if (r.code) {
      return;
    }
  } catch (err) {
    logger.error({ err }, 'Unexpected error');
  } finally {
    const loggerErrors = getProblems().filter((p) => p.level >= ERROR);
    if (loggerErrors.length) {
      shell.exit(1);
    }
  }
})();
