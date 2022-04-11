import { regEx } from '../../../util/regex';

export function smartLinks(body: string): string {
  return body?.replace(regEx(/\]\(\.\.\/pull\//g), '](pulls/');
}

export function trimTrailingApiPath(url: string): string {
  const apiPathIndex = url.indexOf('api/v1');
  return url.slice(0, apiPathIndex > 0 ? apiPathIndex : url.length);
}
