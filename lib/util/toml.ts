import { getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import { regEx } from './regex';

export function parse(input: string): unknown {
  const massagedContent = massageContent(input);
  const ast = parseTOML(massagedContent);
  return getStaticTOMLValue(ast);
}

function massageContent(content: string): string {
  return content
    .replace(regEx(/{%.+?%}/gs), '')
    .replace(regEx(/{{.+?}}/gs), '')
    .replace(regEx(/{#.+?#}/gs), '');
}
