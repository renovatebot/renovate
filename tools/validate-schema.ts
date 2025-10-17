import { readFileSync } from 'fs';
import ajv from 'ajv';
import draft4MetaSchema from 'ajv/lib/refs/json-schema-draft-04.json';

const schema = JSON.parse(readFileSync('renovate-schema.json', 'utf-8'));

const validator = new ajv({ schemaId: 'auto', meta: false });
validator.addMetaSchema(draft4MetaSchema);

const validate = validator.compile(draft4MetaSchema);
const valid = validate(schema);

if (valid) {
  console.log('Schema is valid!');
} else {
  console.error('Schema is invalid:', validate.errors);
  process.exit(1);
}
