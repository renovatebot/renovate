import { readLocalFile } from '../../../../util/fs/index.ts';
import type { Http } from '../../../../util/http/index.ts';
import type { CustomDatasourceFetcher } from './types.ts';

export class JSONFetcher implements CustomDatasourceFetcher {
  async fetch(http: Http, registryURL: string): Promise<unknown> {
    const response = await http.getJsonUnchecked(registryURL);
    return response.body;
  }

  async readFile(registryURL: string): Promise<unknown> {
    const fileContent = await readLocalFile(registryURL, 'utf8');

    return JSON.parse(fileContent!);
  }
}
