import yaml from 'js-yaml';
import { readLocalFile } from '../../../../util/fs';
import type { Http } from '../../../../util/http';
import type { CustomDatasourceFetcher } from './types';

export class YamlFetcher implements CustomDatasourceFetcher {
  async fetch(http: Http, registryURL: string): Promise<unknown> {
    const response = await http.get(registryURL);

    return yaml.load(response.body);
  }

  async readFile(registryURL: string): Promise<unknown> {
    const fileContent = await readLocalFile(registryURL, 'utf8');

    return yaml.load(fileContent!);
  }
}
