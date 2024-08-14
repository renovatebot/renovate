import fs from 'fs-extra';
import upath from 'upath';
import * as Schemas from './schemas/schema';

void (async () => {
  // Specify the path to the 'schemas' directory
  const jsonFileDir = 'lib/data';
  const schemaDir = 'tools/schemas';

  try {
    const schemaFiles = (await fs.readdir(schemaDir)).filter(
      (file) => upath.extname(file) === '.json',
    );
    // Collect errors in an array
    const validationErrors = [];

    for (const schemaFile of schemaFiles) {
      try {
        // get the schema for the file
        const dataFileName = schemaFile.replace('-schema', '');
        const schemaName = `${schemaFile
          .replace('.json', '')
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join('')}` as keyof typeof Schemas;
        // Load the JSON data to validate
        const data = JSON.parse(
          await fs.readFile(upath.join(jsonFileDir, dataFileName), 'utf8'),
        );

        // Validate the data
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

    // Print errors after processing all files
    validationErrors.forEach(({ file, errors }) => {
      console.error(`\n${file}: JSON does not satisfy its schema:`, errors);
    });

    // Exit with an error code if there are validation errors
    if (validationErrors.length > 0) {
      process.exit(1);
    } else {
      console.log('\nValidation completed successfully.');
    }
  } catch (error) {
    console.error('\nError during validation:', error.message);
    process.exit(1);
  }
})();
