import yaml from 'js-yaml';
import { readLocalFile } from '../../../../util/fs';
import type { Http } from '../../../../util/http';

export async function fetch(http: Http, url: string): Promise<unknown> {
  const response = await http.get(url);

  return yaml.load(response.body);
}

export async function read(path: string): Promise<unknown> {
  const fileContent = await readLocalFile(path, 'utf8');

  return fileContent ? yaml.load(fileContent) : null;
}
