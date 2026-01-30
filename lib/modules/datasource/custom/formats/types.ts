import type { Http } from '../../../../util/http/index.ts';

export interface CustomDatasourceFetcher {
  fetch(http: Http, registryURL: string): Promise<unknown>;
  readFile(registryURL: string): Promise<unknown>;
}
