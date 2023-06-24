import URL from 'node:url';
import { ChangeLogSource } from './source';

export class BitbucketChangeLogSource extends ChangeLogSource {
  constructor() {
    super('bitbucket');
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string
  ): string {
    return `${baseUrl}${repository}/branches/compare/${prevHead}%0D${nextHead}`;
  }

  getAPIBaseUrl(sourceUrl: string): string {
    const parsedUrl = URL.parse(sourceUrl);
    const protocol = parsedUrl.protocol!;
    const host = parsedUrl.host!;
    return `${protocol}//api.${host}/`;
  }
}
