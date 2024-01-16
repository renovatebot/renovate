import {
  DumpOptions,
  LoadOptions,
  loadAll as multiple,
  load as single,
  dump as upstreamDump,
} from 'js-yaml';
import { regEx } from './regex';

interface YamlOptions extends LoadOptions {
  removeTemplates?: boolean;
}

export function parseYaml(
  content: string,
  iterator?: null | undefined,
  options?: YamlOptions,
): unknown[] {
  const massagedContent = massageContent(content, options);

  return multiple(massagedContent, iterator, options);
}

export function parseSingleYaml(
  content: string,
  options?: YamlOptions,
): unknown {
  const massagedContent = massageContent(content, options);
  return single(massagedContent, options);
}

export function dump(obj: any, opts?: DumpOptions | undefined): string {
  return upstreamDump(obj, opts);
}

function massageContent(content: string, options?: YamlOptions): string {
  if (options?.removeTemplates) {
    return content
      .replace(regEx(/{{`.+?`}}/gs), '')
      .replace(regEx(/{{.+?}}/g), '').
      .replace(regEx(/{%`.+?`%}/gs), '')
      .replace(regEx(/{%.+?%}/g), '');
  }

  return content;
}
