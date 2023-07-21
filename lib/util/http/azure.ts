import type { AzureBodyPaginated } from '../../types/platform/azure';
import type { HttpOptions, HttpResponse } from './types';
import { Http } from '.';

export class AzureHttp extends Http<HttpOptions> {
  constructor(type = 'azure', options?: HttpOptions) {
    super(type, options);
  }

  async getJsonPaginated<T>(
    url: string,
    continuationToken = ''
  ): Promise<HttpResponse<AzureBodyPaginated<T>>> {
    const option = continuationToken
      ? `&continuationToken=${continuationToken}`
      : '';
    const result = await super.getJson<AzureBodyPaginated<T>>(
      `${url}${option}`
    );
    if (result.headers['x-ms-continuationtoken']) {
      const nextResult = await this.getJsonPaginated<T>(
        url,
        result.headers['x-ms-continuationtoken']
      );
      result.body.value.push(...nextResult.body.value);
    }
    return result;
  }
}
