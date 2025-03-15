import { readLocalFile } from '../../../../util/fs';
import type { Http } from '../../../../util/http';
import { newlineRegex } from '../../../../util/regex';
import type { ReleaseResult } from '../../types';
import type { CustomDatasourceFetcher } from './types';

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
