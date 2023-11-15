import yaml from 'js-yaml';

import type { Http } from '../../../../util/http';

export async function fetch(http: Http, url: string): Promise<unknown> {
  const response = await http.get(url);

  return yaml.load(response.body);
}
