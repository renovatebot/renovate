import { readLocalFile } from '../../../../util/fs/index.ts';
import type { Http } from '../../../../util/http/index.ts';
import { newlineRegex } from '../../../../util/regex.ts';
import type { ReleaseResult } from '../../types.ts';
import type { CustomDatasourceFetcher } from './types.ts';

function convertLinesToVersions(content: string): ReleaseResult {
  const lines = content.split(newlineRegex).map((line) => line.trim());

  const versions = lines.map((value) => {
    return { version: value };
  });

  return {
    releases: versions,
  };
}

export class PlainFetcher implements CustomDatasourceFetcher {
  async fetch(http: Http, registryURL: string): Promise<unknown> {
    const response = await http.getPlain(registryURL);

    return convertLinesToVersions(response.body);
  }

  async readFile(registryURL: string): Promise<unknown> {
    const fileContent = await readLocalFile(registryURL, 'utf8');

    return fileContent ? convertLinesToVersions(fileContent) : null;
  }
}
