import { getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import { regEx } from './regex';

interface TomlOptions {
  removeTemplates?: boolean;
}

export function parse(input: string, options?: TomlOptions): unknown {
  const massagedContent = massageContent(input, options);
  const ast = parseTOML(massagedContent);
  return getStaticTOMLValue(ast);
}

function massageContent(content: string, options?: TomlOptions): string {
  if (options?.removeTemplates) {
    return content
      .replace(regEx(/{%.+?%}/gs), '')
      .replace(regEx(/{{.+?}}/gs), '')
      .replace(regEx(/{#.+?#}/gs), '');
  }
  return content;
}
