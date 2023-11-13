import fs from 'fs-extra';
import type { Http } from '../../../../util/http';

export async function fetch(http: Http, url: string): Promise<unknown> {
  const response = await http.getJson(url);
  return response.body;
}

export async function read(path: string): Promise<unknown> {
  const fileContent = await fs.readFile(path, 'utf8');

  return JSON.parse(fileContent);
}
