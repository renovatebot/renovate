import yaml from 'js-yaml';

import type { Http } from '../../../../util/http';
import { newlineRegex } from '../../../../util/regex';
import type { ReleaseResult } from '../../types';

export async function fetch(
  http: Http,
  url: string,
): Promise<ReleaseResult | null> {
  const response = await http.get(url);

  return yaml.load(response.body.replace(newlineRegex, '\n')) as ReleaseResult;
}
