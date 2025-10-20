import { promises } from 'fs';
import ajv from 'ajv';
import draft4MetaSchema from 'ajv/lib/refs/json-schema-draft-04.json';
import { glob } from 'glob';

async function validateFileAgainstDraft04Schema(
  validate: ajv.ValidateFunction,
  filename: string,
): Promise<ajv.ErrorObject[] | null | undefined> {
  const schema = JSON.parse(await promises.readFile(filename, 'utf-8'));
  const valid = await validate(schema);
  if (!valid) {
    return validate.errors;
  }
}

async function validateDraft04Schemas(): Promise<void> {
  const validator = new ajv({ schemaId: 'auto', meta: false });
  validator.addMetaSchema(draft4MetaSchema);
  const validate = validator.compile(draft4MetaSchema);

  const failed: { filename: string; errors: ajv.ErrorObject[] }[] = [];

  const fileGlobsToValidate = ['renovate-schema.json', 'tools/schemas/*.json'];
  const expandedFiles: string[] = (
    await Promise.all(
      fileGlobsToValidate.map(async (pattern) => await glob(pattern)),
    )
  ).flat();

  for (const filename of expandedFiles) {
    const errors = await validateFileAgainstDraft04Schema(validate, filename);
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

void (async () => {
  await validateDraft04Schemas();
})();
