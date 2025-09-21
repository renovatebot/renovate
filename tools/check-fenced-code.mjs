import AjvConstructor from 'ajv';
import fs from 'fs-extra';
import { glob } from 'glob';
import MarkdownIt from 'markdown-it';
import { MigrationsService } from '../dist/config/migrations/migrations-service.js';

const errorTitle = 'Invalid JSON in fenced code block';
const errorBody =
  'Fix this manually by ensuring each block is a valid, complete JSON document.';
const markdownGlob = '{docs,lib}/**/*.md';
const markdown = new MarkdownIt('zero');

let issues = 0;

markdown.enable(['fence']);

/**
 *
 * @param {string} path
 * @returns {Promise<any>}
 */
async function readAsJson(path) {
  return JSON.parse(await fs.readFile(path, 'utf-8'));
}

const validate = new AjvConstructor({
  extendRefs: true,
  meta: false,
  schemaId: 'id',
})
  .addMetaSchema(
    await readAsJson('node_modules/ajv/lib/refs/json-schema-draft-04.json'),
  )
  .compile(await readAsJson('renovate-schema.json'));

/**
 *
 * @param {string} file
 * @param {number} start
 * @param {number} end
 * @param {string} errorMessage
 */
function reportErrorDetails(file, start, end, errorMessage) {
  issues += 1;
  if (process.env.CI) {
    console.log(
      `::error file=${file},line=${start},endLine=${end},title=${errorTitle}::${errorMessage}. ${errorBody}`,
    );
  } else {
    console.log(
      `${errorTitle} (${file} lines ${start}-${end}): ${errorMessage}`,
    );
  }
}

/**
 * This callback type is called `requestCallback` and is displayed as a global symbol.
 *
 * @callback reporterCallback
 * @param {string} message
 * @returns {void}
 */

/**
 *
 * @param {reporterCallback} reporter
 * @param {import('markdown-it/lib/token.mjs').default} token
 */
function checkValidJson(reporter, token) {
  try {
    return JSON.parse(token.content);
  } catch (err) {
    reporter(err.message);
  }
}

/**
 *
 * @param {reporterCallback} reporter
 * @param {import("../dist/config/types.js").RenovateConfig} value
 */
function checkSchemaCompliantJson(reporter, value) {
  const isValid = validate(value);
  if (!isValid) {
    validate.errors?.forEach((error) => {
      reporter(error.dataPath + ' ' + error.message);
    });
  }
}
/**
 *
 * @param {reporterCallback} reporter
 * @param {import("../dist/config/types.js").RenovateConfig} original
 */
function checkMigrationStatus(reporter, original) {
  const migrated = MigrationsService.run(original);
  if (MigrationsService.isMigrated(original, migrated)) {
    reporter(
      'The JSON contains unmigrated configuration. Migrated JSON: ' +
        JSON.stringify(migrated),
    );
  }
}

/**
 *
 * @param {string} file
 */
async function processFile(file) {
  const text = await fs.readFile(file, 'utf8');
  const tokens = markdown.parse(text, undefined);

  tokens.forEach((token, index) => {
    if (
      token.type === 'fence' &&
      (token.info === 'json' || token.info.startsWith('json '))
    ) {
      /** @type {(message: string) => void} */
      const reporter = (message) => {
        const [start, end] = token.map ?? [-1, -1];
        reportErrorDetails(file, start + 1, end + 1, message);
      };
      const validJson = checkValidJson(reporter, token);

      if (
        validJson !== undefined &&
        (index - 2 < 0 ||
          tokens[index - 2].content !== '<!-- schema-validation-ignore -->')
      ) {
        checkSchemaCompliantJson(reporter, validJson);
        checkMigrationStatus(reporter, validJson);
      }
    }
  });
}

await (async () => {
  const files = await glob(markdownGlob);

  for (const file of files) {
    await processFile(file);
  }

  if (issues) {
    console.error(
      `${issues} issues found. ${errorBody} See above for lines affected.`,
    );
    process.exit(1);
  }
})();
