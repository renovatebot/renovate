import { regEx } from '../../util/regex';
import { parseUrl } from '../../util/url';

interface ParsedRegistryUrl {
  feedUrl: string;
  protocolVersion: number | null;
}

const protocolVersionRegExp = regEx(/#protocolVersion=(?<protocol>2|3)/);

export function parseRegistryUrl(registryUrl: string): ParsedRegistryUrl {
  const parsedUrl = parseUrl(registryUrl);
  if (parsedUrl) {
    const protocolVersionMatchGroup = protocolVersionRegExp.exec(
      parsedUrl.hash
    )?.groups;

    let protocolVersion = 2;
    if (protocolVersionMatchGroup) {
      parsedUrl.hash = '';
      const { protocol } = protocolVersionMatchGroup;
      protocolVersion = parseInt(protocol, 10);
    } else if (parsedUrl.pathname.endsWith('.json')) {
      protocolVersion = 3;
    }
    const feedUrl = parsedUrl.toString().replace(/\/$/, '');
    return { feedUrl, protocolVersion };
  }
  return { feedUrl: registryUrl, protocolVersion: null };
}
