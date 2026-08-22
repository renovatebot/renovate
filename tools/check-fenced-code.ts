import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
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
import { parseJsonc } from '../lib/util/common.ts';
import { getParsedContent } from '../lib/workers/global/config/parse/util.ts';

await init();

const addFormats = _addFormats as unknown as typeof _addFormats.default;

const errorTitle = 'Invalid JSON/JSONC/JavaScript in fenced code block';
const errorBody =
  'Fix this manually by ensuring each block is a valid, complete JSON, JSONC, or JavaScript document.';
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

// Skips config/schema/migration validation for the next block, but the block
// must still be well-formed JSON/JSONC/JavaScript.
const schemaValidationDisableComment =
  '<!-- schema-validation-disable-next-block -->';
// Skips all validation for the next block, including well-formedness, while
// keeping its language tag for syntax highlighting.
const fenceCheckDisableComment = '<!-- doc-fence-check-disable-next-block -->';

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

function checkValidJsonc(file: string, token: Token): object | undefined {
  try {
    return parseJsonc(token.content) as object;
  } catch (err) {
    reportIssue(file, token, err.message);
  }
}

// Docs reference secrets via `process.env.SOME_VAR`, which is unset in CI.
// Stub any unset env var so those examples don't fail on an undefined value.
function withStubbedEnv<T>(fn: () => Promise<T>): Promise<T> {
  const realEnv = process.env;
  process.env = new Proxy(realEnv, {
    get(target, prop) {
      return prop in target ? target[prop as string] : `stub-${String(prop)}`;
    },
  });
  return fn().finally(() => {
    process.env = realEnv;
  });
}

// Some docs show a bare object literal instead of a full `module.exports = {...}`
// config file. At the top of a script/module, `{...}` parses as a block
// statement rather than an object expression, so wrap it to get the intended value.
function toModuleSource(content: string): string {
  const trimmed = content.trim();
  if (
    /module\.exports|export\s+default|export\s*\{/.test(trimmed) ||
    !trimmed.startsWith('{')
  ) {
    return content;
  }
  return `module.exports = (${content});`;
}

async function checkValidJs(
  file: string,
  token: Token,
): Promise<object | undefined> {
  const tmpFile = path.join(
    os.tmpdir(),
    `renovate-doc-fence-${randomUUID()}.js`,
  );
  try {
    await fs.writeFile(tmpFile, toModuleSource(token.content));
    return await withStubbedEnv(() => getParsedContent(tmpFile));
  } catch (err) {
    reportIssue(file, token, err.message);
  } finally {
    await fs.remove(tmpFile);
  }
}

function isJsCheckAllowed(file: string): boolean {
  return (
    file.startsWith('docs/') ||
    (file.startsWith('lib/') &&
      path.basename(file).toLowerCase() === 'readme.md')
  );
}

async function parseFenceValue(
  lang: string,
  file: string,
  token: Token,
): Promise<object | undefined> {
  if (lang === 'json') {
    return checkValidJson(file, token);
  }
  if (lang === 'jsonc') {
    return checkValidJsonc(file, token);
  }
  return checkValidJs(file, token);
}

function checkSchemaCompliantJson(
  file: string,
  token: Token,
  value: object,
): RenovateConfig | undefined {
  const isValid = validate(value);
  if (isValid) {
    return value;
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
    if (token.type !== 'fence') {
      continue;
    }

    const lang = token.info.trim().split(/\s+/)[0];
    const isJsFamily = lang === 'js' || lang === 'javascript';
    if (
      !['json', 'jsonc', 'js', 'javascript'].includes(lang) ||
      (isJsFamily && !isJsCheckAllowed(file)) ||
      tokens.at(index - 2)?.content === fenceCheckDisableComment
    ) {
      continue;
    }

    const parsedValue = await parseFenceValue(lang, file, token);
    if (
      parsedValue === undefined ||
      tokens.at(index - 2)?.content === schemaValidationDisableComment
    ) {
      continue;
    }
    const configuration = checkSchemaCompliantJson(file, token, parsedValue);
    if (configuration !== undefined) {
      checkMigrationStatus(file, token, configuration);

      const massagedConfig = massageConfig(configuration);

      if (!token.info.includes('configType=none')) {
        // JS config files (`config.js`) are only ever loaded as global/self-hosted
        // config, so default `js`/`javascript` blocks to `global` unlike `json`/`jsonc`.
        const defaultConfigType = isJsFamily ? 'global' : 'repo';
        let configType: 'global' | 'repo' = defaultConfigType;
        if (token.info.includes('configType=global')) {
          configType = 'global';
        } else if (token.info.includes('configType=repo')) {
          configType = 'repo';
        }
        const { errors, warnings } = await validateConfig(
          configType,
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
