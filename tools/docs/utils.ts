import { logger } from '../../lib/logger/index.ts';
import type { ModuleApi } from '../../lib/types/index.ts';
import { regEx } from '../../lib/util/regex.ts';
import { capitalize } from '../../lib/util/string.ts';
import { readFile } from '../utils/index.ts';

const defaultReplaceStart =
  '<!-- Autogenerate in https://github.com/renovatebot/renovate -->';
const defaultReplaceStop = '<!-- Autogenerate end -->';
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
  opts: {
    replaceStart: string;
    replaceStop: string;
  } = { replaceStart: defaultReplaceStart, replaceStop: defaultReplaceStop },
): string {
  const replaceStartIndex = content.indexOf(opts.replaceStart);
  const replaceStopIndex = content.indexOf(opts.replaceStop);

  if (replaceStartIndex < 0) {
    logger.error('Missing replace placeholder');
    return content;
  }
  return (
    content.slice(0, replaceStartIndex) +
    txt +
    content.slice(replaceStopIndex + opts.replaceStop.length)
  );
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
