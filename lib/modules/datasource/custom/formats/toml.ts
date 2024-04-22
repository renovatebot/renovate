import { readLocalFile } from '../../../../util/fs';
import { parse as parseToml } from '../../../../util/toml';
import type { Http } from '../../../../util/http';
import type { CustomDatasourceFetcher } from './types';

export class TomlFetcher implements CustomDatasourceFetcher {
  async fetch(http: Http, registryURL: string): Promise<unknown> {
    const response = await http.getToml(registryURL)

    const contentType = response.headers['content-type'];
    if (!contentType?.startsWith('application/toml')) {
      return null;
    }

    return parseToml(response.body);
  }

  async readFile(registryURL: string): Promise<unknown> {
    const fileContent = await readLocalFile(registryURL, 'utf8');

    return parseToml(fileContent!);
  }
}
