import { format } from 'node:util';
import type { ValidateFunction } from 'ajv';
import { Ajv } from 'ajv';
import draft7MetaSchema from 'ajv/lib/refs/json-schema-draft-07.json' with { type: 'json' };
import _addFormats from 'ajv-formats';
import fs from 'fs-extra';
import { glob } from 'glob';
import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { GlobalConfig } from '../lib/config/global.ts';
import { massageConfig } from '../lib/config/massage.ts';
import { migrateConfig } from '../lib/config/migration.ts';
import type { RenovateConfig } from '../lib/config/types.ts';
import { validateConfig } from '../lib/config/validation.ts';
import { init } from '../lib/logger/index.ts';

await init();

const addFormats = _addFormats as unknown as typeof _addFormats.default;

const errorTitle = 'Invalid JSON in fenced code block';
const errorBody =
  'Fix this manually by ensuring each block is a valid, complete JSON document.';
const errorLogFormat = process.env.CI
  ? `::error file=%s,line=%d,endLine=%d,title=${errorTitle}::%s. ${errorBody}`
  : `${errorTitle} (%s lines %d-%d): %s`;

const warningLogFormat = process.env.CI
  ? `::warning file=%s,line=%d,endLine=%d,title=${errorTitle}::%s. ${errorBody}`
  : `${errorTitle}\n(%s lines %d-%d):\n%s`;

function reportIssue(file: string, token: Token, message: string): void {
  const [start, end] = token.map ?? [-1, -1];
  issues += 1;
  console.error(format(errorLogFormat, file, start + 1, end + 1, message));
}

function reportWarning(file: string, token: Token, message: string): void {
  const [start, end] = token.map ?? [-1, -1];
  issues += 1;
  console.warn(format(warningLogFormat, file, start + 1, end + 1, message));
}

const markdownGlob = '{docs,lib}/**/*.md';
const markdown = new MarkdownIt('zero');

let issues = 0;

markdown.enable(['fence']);

let validate: ValidateFunction;

function checkValidJson(file: string, token: Token): object | undefined {
  try {
    return JSON.parse(token.content);
  } catch (err) {
    reportIssue(file, token, err.message);
  }
}

function checkSchemaCompliantJson(
  file: string,
  token: Token,
  value: object,
): RenovateConfig | undefined {
  const isValid = validate(value);
  if (isValid) {
    return value as RenovateConfig;
  }
  for (const error of validate.errors ?? []) {
    reportIssue(file, token, `${error.instancePath} ${error.message}`);
  }
}

function checkMigrationStatus(
  file: string,
  token: Token,
  original: RenovateConfig,
): void {
  const { isMigrated, migratedConfig } = migrateConfig(original);
  if (isMigrated) {
    reportIssue(
      file,
      token,
      `The JSON contains unmigrated configuration. Migrated JSON: ${JSON.stringify(migratedConfig)}`,
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

    const validJson = checkValidJson(file, token);
    if (
      validJson === undefined ||
      tokens.at(index - 2)?.content ===
        '<!-- schema-validation-disable-next-block -->'
    ) {
      continue;
    }
    const configuration = checkSchemaCompliantJson(file, token, validJson);
    if (configuration !== undefined) {
      checkMigrationStatus(file, token, configuration);

      const massagedConfig = massageConfig(configuration);

      if (!token.info.includes('configType=none')) {
        const { errors, warnings } = await validateConfig(
          token.info.includes('configType=global') ? 'global' : 'repo',
          massagedConfig,
        );

        if (errors.length) {
          reportIssue(
            file,
            token,
            `The JSON contains Renovate configuration validation errors: ${JSON.stringify(errors, null, 2)}`,
          );
        }

        if (
          warnings.length &&
          !token.info.includes('ignoreConfigWarnings=true')
        ) {
          reportWarning(
            file,
            token,
            `The JSON contains Renovate configuration validation warnings: ${JSON.stringify(warnings, null, 2)}`,
          );
        }
      }
    }
  }
}

void (async () => {
  const validator = new Ajv({ schemaId: '$id', meta: false }).addMetaSchema(
    draft7MetaSchema,
  );
  addFormats(validator);
  validate = validator.compile(draft7MetaSchema);

  GlobalConfig.set({
    // any environment vars that any repository configuration in the documentation references
    allowedEnv: [
      'SOME_ENV_VARIABLE',
      'GONOSUMDB',
      'SOME_ENV_*',
      'EXTRA_ENV_NAME',
    ],
  });

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
