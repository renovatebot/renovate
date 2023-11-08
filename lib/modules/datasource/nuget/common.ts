import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { ParsedRegistryUrl } from './types';

const buildMetaRe = regEx(/\+.+$/g);

export function removeBuildMeta(version: string): string {
  return version.replace(buildMetaRe, '');
}

const urlWhitespaceRe = regEx(/\s/g);

export function massageUrl(url: string): string {
  let resultUrl = url;

  // During `dotnet pack` certain URLs are being URL decoded which may introduce whitespaces
  // and causes Markdown link generation problems.
  resultUrl = resultUrl.replace(urlWhitespaceRe, '%20');

  return resultUrl;
}

const protocolVersionRegExp = regEx(/#protocolVersion=(?<protocol>2|3)/);

export function parseRegistryUrl(registryUrl: string): ParsedRegistryUrl {
  const parsedUrl = parseUrl(registryUrl);
  if (!parsedUrl) {
    logger.debug(
      { urL: registryUrl },
      `nuget registry failure: can't parse ${registryUrl}`,
    );
    return { feedUrl: registryUrl, protocolVersion: null };
  }
  let protocolVersion = 2;
  const protocolVersionMatch = protocolVersionRegExp.exec(parsedUrl.hash)
    ?.groups;
  if (protocolVersionMatch) {
    const { protocol } = protocolVersionMatch;
    parsedUrl.hash = '';
    protocolVersion = Number.parseInt(protocol, 10);
  } else if (parsedUrl.pathname.endsWith('.json')) {
    protocolVersion = 3;
  }

  const feedUrl = parsedUrl.href;
  return { feedUrl, protocolVersion };
}
