import {
  DumpOptions,
  LoadOptions,
  loadAll as multiple,
  load as single,
  dump as upstreamDump,
} from 'js-yaml';
import type { ZodType } from 'zod';
import { regEx } from './regex';

type YamlOptions<
  ResT = unknown,
  Schema extends ZodType<ResT> = ZodType<ResT>,
> = {
  customSchema?: Schema;
  removeTemplates?: boolean;
} & LoadOptions;

export function parseYaml<ResT = unknown>(
  content: string,
  iterator?: null | undefined,
  options?: YamlOptions<ResT>,
): ResT[] {
  const massagedContent = massageContent(content, options);

  const rawDocuments = multiple(massagedContent, iterator, options);

  const schema = options?.customSchema;
  if (!schema) {
    return rawDocuments as ResT[];
  }

  const parsed: ResT[] = [];
  for (const element of rawDocuments) {
    const singleParsed = schema.parse(element);
    parsed.push(singleParsed);
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
      .replace(regEx(/{{`.+?`}}/gs), '')
      .replace(regEx(/{{.+?}}/g), '')
      .replace(regEx(/{%`.+?`%}/gs), '')
      .replace(regEx(/{%.+?%}/g), '');
  }

  return content;
}
