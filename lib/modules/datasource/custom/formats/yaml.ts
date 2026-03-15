import { readLocalFile } from '../../../../util/fs/index.ts';
import type { Http } from '../../../../util/http/index.ts';
import { parseSingleYaml } from '../../../../util/yaml.ts';
import type { CustomDatasourceFetcher } from './types.ts';

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
