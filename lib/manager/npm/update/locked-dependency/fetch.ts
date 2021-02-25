import url from 'url';
import { NpmResponse } from '../../../../datasource/npm/get';
import { Http } from '../../../../util/http';

const http = new Http('npm');

export async function fetchRegistryDetails(
  depName: string
): Promise<NpmResponse> {
  const pkgUrl = url.resolve(
    'https://registry.npmjs.org/',
    encodeURIComponent(depName).replace(/^%40/, '@')
  );
  return (await http.getJson<NpmResponse>(pkgUrl)).body;
}
