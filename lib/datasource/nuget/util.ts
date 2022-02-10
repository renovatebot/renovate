import url from 'url';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';

export function parseRegistryUrl(registryUrl: string): {
  feedUrl: string;
  protocolVersion: number;
} {
  try {
    const parsedUrl = url.parse(registryUrl);
    let protocolVersion = 2;
    const protocolVersionRegExp = regEx(/#protocolVersion=(2|3)/);
    const protocolVersionMatch = protocolVersionRegExp.exec(parsedUrl.hash);
    if (protocolVersionMatch) {
      parsedUrl.hash = '';
      protocolVersion = Number.parseInt(protocolVersionMatch[1], 10);
    } else if (parsedUrl.pathname.endsWith('.json')) {
      protocolVersion = 3;
    }
    return { feedUrl: url.format(parsedUrl), protocolVersion };
  } catch (err) {
    logger.debug({ err }, `nuget registry failure: can't parse ${registryUrl}`);
    return { feedUrl: registryUrl, protocolVersion: null };
  }
}
