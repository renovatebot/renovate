import { ERROR } from 'bunyan';
import fs from 'fs-extra';
import * as tar from 'tar';
import { getProblems, logger } from '../lib/logger';
import { generateConfig } from './docs/config';
import { generateDatasources } from './docs/datasources';
import { getOpenGitHubItems } from './docs/github-query-items';
import { generateManagers } from './docs/manager';
import { generateManagerAsdfSupportedPlugins } from './docs/manager-asdf-supported-plugins';
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

    logger.info('generating docs');

    await fs.mkdir(`${dist}/`, { recursive: true });

    logger.info('* static');
    await fs.copy('docs/usage/.', `${dist}`);

    logger.info('* fetching open GitHub issues');
    const openItems = await getOpenGitHubItems();

    logger.info('* platforms');
    await generatePlatforms(dist, openItems.platforms);

    // versionings
    logger.info('* versionings');
    await generateVersioning(dist);

    // datasources
    logger.info('* datasources');
    await generateDatasources(dist, openItems.datasources);

    // managers
    logger.info('* managers');
    await generateManagers(dist, openItems.managers);

    // managers/asdf supported plugins
    logger.info('* managers/asdf/supported-plugins');
    await generateManagerAsdfSupportedPlugins(dist);

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

    await tar.create(
      { file: './tmp/docs.tgz', cwd: './tmp/docs', gzip: true },
      ['.']
    );
  } catch (err) {
    logger.error({ err }, 'Unexpected error');
  } finally {
    const loggerErrors = getProblems().filter((p) => p.level >= ERROR);
    if (loggerErrors.length) {
      process.exit(1);
    }
  }
})();
