import type {
  CreateNodeOptions,
  DocumentOptions,
  ParseOptions,
  SchemaOptions,
  ToStringOptions,
} from 'yaml';
import { parseAllDocuments, parseDocument, stringify } from 'yaml';
import type { ZodType } from 'zod';
import { logger } from '../logger';
import { regEx } from './regex';

interface YamlOptions<
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>,
> extends ParseOptions,
    DocumentOptions,
    SchemaOptions {
  customSchema?: Schema;
  removeTemplates?: boolean;
}

interface YamlOptionsMultiple<
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>,
> extends YamlOptions<ResT, Schema> {
  failureBehaviour?: 'throw' | 'filter';
}

export type DumpOptions = DocumentOptions &
  SchemaOptions &
  ParseOptions &
  CreateNodeOptions &
  ToStringOptions;

/**
 * Parse a YAML string into a JavaScript object.
 *
 * Multiple documents are supported.
 *
 * If a schema is provided, the parsed object will be validated against it.
 *
 * If failureBehaviour is set to 'filter',
 *      the function will return an empty array if the YAML parsing or schema validation fails and therefore will not throw an error.
 *
 * If failureBehaviour is set to 'throw',
 *      the function will throw an error if the YAML parsing or schema validation fails for ANY document.
 * @param content
 * @param options
 */
export function parseYaml<ResT = unknown>(
  content: string,
  options?: YamlOptionsMultiple<ResT>,
): ResT[] {
  const massagedContent = massageContent(content, options);

  const rawDocuments = parseAllDocuments(
    massagedContent,
    prepareParseOption(options),
  );

  const schema = options?.customSchema;

  const results: ResT[] = [];
  for (const rawDocument of rawDocuments) {
    const errors = rawDocument.errors;
    // handle YAML parse errors
    if (errors?.length) {
      const error = new AggregateError(errors, 'Failed to parse YAML file');
      if (options?.failureBehaviour === 'filter') {
        logger.debug(`Failed to parse YAML file: ${error.message}`);
        continue;
      }
      throw error;
    }

    const document = rawDocument.toJS({ maxAliasCount: 10000 });

    // skip schema validation if no schema is provided
    if (!schema) {
      results.push(document as ResT);
      continue;
    }

    const result = schema.safeParse(document);
    if (result.success) {
      results.push(result.data);
      continue;
    }

    // handle schema validation errors
    if (options?.failureBehaviour === 'filter') {
      logger.trace(
        { error: result.error, document },
        'Failed to parse schema for YAML',
      );
      continue;
    }
    throw new Error('Failed to parse YAML file', { cause: result.error });
  }

  return results;
}

/**
 * Parse a YAML string into a JavaScript object.
 *
 * Only a single document is supported.
 *
 * If a schema is provided, the parsed object will be validated against it.
 * Should the YAML parsing or schemata validation fail, an error will be thrown.
 *
 * @param content
 * @param options
 */
export function parseSingleYaml<ResT = unknown>(
  content: string,
  options?: YamlOptions<ResT>,
): ResT {
  const massagedContent = massageContent(content, options);
  const rawDocument = parseDocument(
    massagedContent,
    prepareParseOption(options),
  );

  if (rawDocument?.errors?.length) {
    throw new AggregateError(rawDocument.errors, 'Failed to parse YAML file');
  }

  const document = rawDocument.toJS({ maxAliasCount: 10000 });
  const schema = options?.customSchema;
  if (!schema) {
    return document as ResT;
  }

  return schema.parse(document);
}

export function dump(obj: any, opts?: DumpOptions): string {
  return stringify(obj, opts);
}

function massageContent(content: string, options?: YamlOptions): string {
  if (options?.removeTemplates) {
    return content
      .replace(regEx(/\s+{{.+?}}:.+/gs), '')
      .replace(regEx(/{{`.+?`}}/gs), '')
      .replace(regEx(/{{.+?}}/gs), '')
      .replace(regEx(/{%`.+?`%}/gs), '')
      .replace(regEx(/{%.+?%}/g), '');
  }

  return content;
}

function prepareParseOption(options: YamlOptions | undefined): YamlOptions {
  return {
    prettyErrors: true,
    // if we're removing templates, we can run into the situation where we have duplicate keys
    uniqueKeys: !options?.removeTemplates,
    strict: false,
    ...options,
  };
}
