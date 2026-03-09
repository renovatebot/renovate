import { readLocalFile } from '../../../../util/fs/index.ts';
import type { Http } from '../../../../util/http/index.ts';
import { parse as parseToml } from '../../../../util/toml.ts';
import type { CustomDatasourceFetcher } from './types.ts';

export class TomlFetcher implements CustomDatasourceFetcher {
  async fetch(http: Http, registryURL: string): Promise<unknown> {
    const response = await http.getToml(registryURL);

    return response.body;
  }

  async readFile(registryURL: string): Promise<unknown> {
    const fileContent = await readLocalFile(registryURL, 'utf8');

    return parseToml(fileContent!);
  }
}
