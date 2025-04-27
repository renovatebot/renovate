import { readLocalFile } from '../../../../util/fs';
import type { Http } from '../../../../util/http';
import { parseSingleYaml } from '../../../../util/yaml';
import type { CustomDatasourceFetcher } from './types';

export class YamlFetcher implements CustomDatasourceFetcher {
  async fetch(http: Http, registryURL: string): Promise<unknown> {
    const response = await http.getText(registryURL);

    return parseSingleYaml(response.body);
  }

  async readFile(registryURL: string): Promise<unknown> {
    const fileContent = await readLocalFile(registryURL, 'utf8');

    return parseSingleYaml(fileContent!);
  }
}
