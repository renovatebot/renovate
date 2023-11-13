import type { Http } from '../../../../util/http';

export async function fetch(http: Http, url: string): Promise<unknown> {
  const response = await http.getJson(url);
  return response.body;
}
