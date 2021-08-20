import Marshal from 'marshal';
import urlJoin from 'url-join';
import { logger } from '../../logger';
import { Http } from '../../util/http';
import { getQueryString } from '../../util/url';

export const id = 'rubygems';
export const http = new Http(id);

export const knownFallbackHosts = ['rubygems.pkg.github.com', 'gitlab.com'];

export async function fetchJson<T>(
  dependency: string,
  registry: string,
  path: string
): Promise<T> {
  const url = urlJoin(registry, path, `${dependency}.json`);

  logger.trace({ registry, dependency, url }, `RubyGems lookup request`);
  const response = (await http.getJson<T>(url)) || {
    body: undefined,
  };

  return response.body;
}

export async function fetchBuffer<T>(
  dependency: string,
  registry: string,
  path: string
): Promise<T> {
  const url = `${urlJoin(registry, path)}?${getQueryString({
    gems: dependency,
  })}`;

  logger.trace({ registry, dependency, url }, `RubyGems lookup request`);
  const response = await http.getBuffer(url);

  return new Marshal(response.body).parsed as T;
}
