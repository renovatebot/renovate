import type { ValidateFunction } from 'ajv';
// eslint-disable-next-line import-x/no-unresolved
import Ajv from 'ajv';
// eslint-disable-next-line import-x/no-unresolved
import * as draft04 from 'ajv/lib/refs/json-schema-draft-04.json';
import fs from 'fs-extra';
import { glob } from 'glob';
import type { Token } from 'markdown-it';
import MarkdownIt from 'markdown-it';
import { MigrationsService } from '../lib/config/migrations';
import type { RenovateConfig } from '../lib/config/types';

const errorTitle = 'Invalid JSON in fenced code block';
const errorBody =
  'Fix this manually by ensuring each block is a valid, complete JSON document.';
const markdownGlob = '{docs,lib}/**/*.md';
const markdown = new MarkdownIt('zero');

let issues = 0;

markdown.enable(['fence']);

let validate: ValidateFunction;

/**
 *
 * @param {string} file
 * @param {number} start
 * @param {number} end
 * @param {string} errorMessage
 */
function reportErrorDetails(
  file: string,
  start: number,
  end: number,
  errorMessage: string,
): void {
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

type ReporterCallback = (message: string) => void;

function checkValidJson(
  reporter: ReporterCallback,
  token: Token,
): object | undefined {
  try {
    return JSON.parse(token.content);
  } catch (err) {
    reporter(err.message);
  }
}

function checkSchemaCompliantJson(
  reporter: ReporterCallback,
  value: object,
): RenovateConfig | undefined {
  const isValid = validate(value);
  if (isValid) {
    return value as RenovateConfig;
  }
  validate.errors?.forEach((error) => {
    reporter(error.dataPath + ' ' + error.message);
  });
}

function checkMigrationStatus(
  reporter: ReporterCallback,
  original: RenovateConfig,
): void {
  const migrated = MigrationsService.run(original);
  if (MigrationsService.isMigrated(original, migrated)) {
    reporter(
      'The JSON contains unmigrated configuration. Migrated JSON: ' +
        JSON.stringify(migrated),
    );
  }
}

async function processFile(file: string): Promise<void> {
  const text = await fs.readFile(file, 'utf8');
  const tokens = markdown.parse(text, undefined);

  for (const [index, token] of tokens.entries()) {
    if (
      token.type !== 'fence' ||
      !(token.info === 'json' || token.info.startsWith('json '))
    ) {
      continue;
    }

    const reporter: ReporterCallback = (message) => {
      const [start, end] = token.map ?? [-1, -1];
      reportErrorDetails(file, start + 1, end + 1, message);
    };
    const validJson = checkValidJson(reporter, token);
    if (
      validJson === undefined ||
      tokens[index - 2]?.content === '<!-- schema-validation-ignore -->'
    ) {
      continue;
    }
    const configuration = checkSchemaCompliantJson(reporter, validJson);
    if (configuration !== undefined) {
      checkMigrationStatus(reporter, configuration);
    }
  }
}

void (async () => {
  validate = new Ajv({
    extendRefs: true,
    meta: false,
    schemaId: 'id',
  })
    .addMetaSchema(draft04)
    .compile(await fs.readJson('renovate-schema.json'));

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
