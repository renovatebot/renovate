import { logger } from '../../lib/logger/index.ts';
import type { ModuleApi } from '../../lib/types/index.ts';
import { regEx } from '../../lib/util/regex.ts';
import { capitalize } from '../../lib/util/string.ts';
import { readFile } from '../utils/index.ts';

const defaultReplaceStart =
  '<!-- Autogenerate in https://github.com/renovatebot/renovate -->';
const goodUrlRegex = regEx(/\[(.+?)\]\((.+?)\)/);

export function formatName(input: string): string {
  return input.split('-').map(capitalize).join(' ');
}

export function getDisplayName(
  moduleName: string,
  moduleDefinition: ModuleApi,
): string {
  return moduleDefinition.displayName ?? formatName(moduleName);
}

export function getNameWithUrl(
  moduleName: string,
  moduleDefinition: ModuleApi,
): string {
  const displayName = getDisplayName(moduleName, moduleDefinition);
  if (moduleDefinition.url) {
    return `[${displayName}](${moduleDefinition.url})`;
  }
  return displayName;
}

export function replaceContent(
  content: string,
  txt: string,
  replaceStart = defaultReplaceStart,
): string {
  const startIndex = content.indexOf(replaceStart);

  if (startIndex < 0) {
    logger.error('Missing replace placeholder');
    return content;
  }

  const endOfLine = content.indexOf('\n', startIndex);
  const after = endOfLine < 0 ? '' : content.slice(endOfLine + 1);
  return content.slice(0, startIndex) + txt + after;
}

export function formatUrls(urls: string[] | null | undefined): string {
  if (Array.isArray(urls) && urls.length) {
    return `## References\n\n${urls
      .map((url) => {
        if (goodUrlRegex.test(url)) {
          return ` - ${url}`;
        }
        return ` - [${url}](${url})`;
      })
      .join('\n')}\n\n`;
  }
  return '';
}

export async function formatDescription(
  type: string,
  name: string,
): Promise<string> {
  const content = await readFile(`lib/modules/${type}/${name}/readme.md`);
  if (!content) {
    return '';
  }
  return `## Description\n\n${content}\n`;
}

export function getModuleLink(module: string, title?: string): string {
  return `[${title ?? module}](${module}/index.md)`;
}

// Helper: format a cell based on row type
export function formatCell(row: string[], colIndex: number): string {
  const col = row[colIndex] ?? '';

  const firstCol = (row[0] ?? '').toLowerCase().trim();
  const isParentsRow = firstCol === 'parents';

  // Special formatting for "parents" row, second column
  if (isParentsRow && colIndex === 1) {
    const items = col
      .split(',')
      .sort((a, b) => a.localeCompare(b))
      .map((s) => `<code>${s.trim()}</code>`)
      .map((item) => `<span>${item}</span>`)
      .join('')
      .replace('>.<', '>(the root document)<');
    return `<td class="parents">${items}</td>`;
  }

  // Default cell
  return `<td>${col}</td>`;
}
