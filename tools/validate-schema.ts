import { promises } from 'fs';
import ajv from 'ajv';
import draft7MetaSchema from 'ajv/lib/refs/json-schema-draft-07.json';
import { glob } from 'glob';

async function validateFileAgainstSchema(
  validate: ajv.ValidateFunction,
  filename: string,
): Promise<ajv.ErrorObject[] | null | undefined> {
  const schema = JSON.parse(await promises.readFile(filename, 'utf-8'));
  const valid = await validate(schema);
  if (!valid) {
    return validate.errors;
  }
}

async function validateFileAgainstSchemaFromFile(
  schemaFilename: string,
  filename: string,
): Promise<ajv.ErrorObject[] | null | undefined> {
  const data = JSON.parse(await promises.readFile(filename, 'utf-8'));
  const schema = JSON.parse(await promises.readFile(schemaFilename, 'utf-8'));
  const validator = new ajv({ schemaId: 'auto', meta: false });
  validator.addMetaSchema(draft7MetaSchema);
  const validate = validator.compile(schema);
  const valid = await validate(data);
  if (!valid) {
    return validate.errors;
  }
}

async function validateSchemas(): Promise<void> {
  const validator = new ajv({ schemaId: 'auto', meta: false });
  validator.addMetaSchema(draft7MetaSchema);
  const validate = validator.compile(draft7MetaSchema);

  const failed: { filename: string; errors: ajv.ErrorObject[] }[] = [];

  const fileGlobsToValidate = ['renovate-schema.json', 'tools/schemas/*.json'];
  const expandedFiles: string[] = (
    await Promise.all(
      fileGlobsToValidate.map(async (pattern) => await glob(pattern)),
    )
  ).flat();

  for (const filename of expandedFiles) {
    const errors = await validateFileAgainstSchema(validate, filename);
    if (errors) {
      failed.push({ filename, errors });
    } else {
      console.log(`Schema in ${filename} is valid!`);
    }
  }

  if (failed.length > 0) {
    for (const f of failed) {
      console.error(`Schema in ${f.filename} is invalid:`, f.errors);
    }

    process.exit(1);
  }
}

async function validateDataFilesAgainstSchemas(): Promise<void> {
  const filesAndSchemasToValidate: {
    schemaFilename: string;
    filename: string;
  }[] = [
    {
      schemaFilename: 'tools/schemas/abandonments-schema.json',
      filename: 'lib/data/abandonments.json',
    },
    {
      schemaFilename: 'tools/schemas/changelog-urls-schema.json',
      filename: 'lib/data/changelog-urls.json',
    },
    {
      schemaFilename: 'tools/schemas/monorepo-schema.json',
      filename: 'lib/data/monorepo.json',
    },
    {
      schemaFilename: 'tools/schemas/replacements-schema.json',
      filename: 'lib/data/replacements.json',
    },
    {
      schemaFilename: 'tools/schemas/source-urls-schema.json',
      filename: 'lib/data/source-urls.json',
    },
  ];

  const failed: {
    schemaFilename: string;
    filename: string;
    errors: ajv.ErrorObject[];
  }[] = [];

  for (const filename of filesAndSchemasToValidate) {
    const errors = await validateFileAgainstSchemaFromFile(
      filename.schemaFilename,
      filename.filename,
    );
    if (errors) {
      failed.push({ ...filename, errors });
    } else {
      console.log(
        `${filename.filename} validated correctly against schema from ${filename.schemaFilename}!`,
      );
    }
  }

  if (failed.length > 0) {
    for (const f of failed) {
      console.error(
        `${f.filename} failed to validate against schema from ${f.schemaFilename}:`,
        f.errors,
      );
    }

    process.exit(1);
  }
}

void (async () => {
  await validateSchemas();
  await validateDataFilesAgainstSchemas();
})();
