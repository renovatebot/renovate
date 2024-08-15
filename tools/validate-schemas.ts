import fs from 'fs-extra';
import upath from 'upath';
import { logger } from '../lib/logger';
import { capitalize } from './docs/utils';
import * as Schemas from './schemas/schema';

void (async () => {
  logger.debug('Validating lib/data JSOn files against their schemas.');
  const dataFileDir = 'lib/data';
  const schemaDir = 'tools/schemas';

  try {
    const schemaFiles = (await fs.readdir(schemaDir)).filter(
      (file) => upath.extname(file) === '.json',
    );

    const validationErrors = [];

    for (const schemaFile of schemaFiles) {
      try {
        const dataFileName = schemaFile.replace('-schema', '');
        const schemaName = `${schemaFile
          .replace('.json', '')
          .split('-')
          .map(capitalize)
          .join('')}` as keyof typeof Schemas;

        const data = JSON.parse(
          await fs.readFile(upath.join(dataFileDir, dataFileName), 'utf8'),
        );

        // validate the data
        // eslint-disable-next-line import/namespace
        const result = Schemas[schemaName].safeParse(data);

        if (result.error) {
          validationErrors.push({
            file: dataFileName,
            errors: result.error.errors,
          });
        }
      } catch (err) {
        validationErrors.push({
          file: schemaFile,
          errors: [
            {
              message: `\nError reading or parsing JSON Schema: ${err.message}`,
            },
          ],
        });
      }
    }

    // print errors after processing all files
    validationErrors.forEach(({ file, errors }) => {
      logger.error({ errors, file }, `JSON does not satisfy its schema`);
    });

    if (validationErrors.length > 0) {
      process.exit(1);
    } else {
      logger.info('All JSON files satisfy their schemas.');
    }
  } catch (error) {
    logger.error(
      { message: error.message },
      'Error during schema validation of json files.',
    );
    process.exit(1);
  }
})();
