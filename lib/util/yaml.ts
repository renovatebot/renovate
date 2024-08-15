import {
  DumpOptions,
  LoadOptions,
  loadAll as multiple,
  load as single,
  dump as upstreamDump,
} from 'js-yaml';
import type { ZodType } from 'zod';
import { logger } from '../logger';
import { regEx } from './regex';

interface YamlOptions<
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>,
> extends LoadOptions {
  customSchema?: Schema;
  removeTemplates?: boolean;
}

interface YamlOptionsMultiple<
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>,
> extends YamlOptions<ResT, Schema> {
  failureBehaviour?: 'throw' | 'filter';
}

export function parseYaml<ResT = unknown>(
  content: string,
  options?: YamlOptionsMultiple<ResT>,
): ResT[] {
  const massagedContent = massageContent(content, options);

  const rawDocuments = multiple(massagedContent, null, options);

  const schema = options?.customSchema;
  if (!schema) {
    return rawDocuments as ResT[];
  }

  const parsed: ResT[] = [];
  for (const element of rawDocuments) {
    const result = schema.safeParse(element);
    if (result.success) {
      parsed.push(result.data);
      continue;
    }

    if (options?.failureBehaviour !== 'filter') {
      throw new Error('Failed to parse YAML file', { cause: result.error });
    }
    logger.trace(
      { error: result.error, document: element },
      'Failed to parse schema for YAML',
    );
  }
  return parsed;
}

export function parseSingleYaml<ResT = unknown>(
  content: string,
  options?: YamlOptions<ResT>,
): ResT {
  const massagedContent = massageContent(content, options);
  const rawDocument = single(massagedContent, options);

  const schema = options?.customSchema;
  if (!schema) {
    return rawDocument as ResT;
  }

  return schema.parse(rawDocument);
}

export function dump(obj: any, opts?: DumpOptions | undefined): string {
  return upstreamDump(obj, opts);
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
