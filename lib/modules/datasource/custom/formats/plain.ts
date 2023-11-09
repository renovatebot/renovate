import type { Http } from '../../../../util/http';
import { newlineRegex } from '../../../../util/regex';
import type { ReleaseResult } from '../../types';

export async function fetch(
  http: Http,
  url: string,
): Promise<ReleaseResult | null> {
  const response = await http.getPlain(url);
  const contentType = response.headers['content-type'];
  if (!contentType?.startsWith('text/')) {
    return null;
  }
  const lines = response.body.split(newlineRegex).map((line) => line.trim());

  const versions = lines.map((value) => {
    return { version: value };
  });

  return {
    releases: versions,
  };
}
