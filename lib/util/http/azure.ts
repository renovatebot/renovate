import { PlatformId } from '../../constants';
import type { AzureBodyPaginated, AzureTag } from '../../types/platform/azure';
import type { HttpOptions, HttpResponse } from './types';
import { Http } from '.';

export class AzureHttp extends Http<HttpOptions> {
  http: any;
  constructor(type: string = PlatformId.Azure, options?: HttpOptions) {
    super(type, options);
  }

  async getJsonPaginated(
    url: string,
    continuationToken = ''
  ): Promise<HttpResponse<AzureBodyPaginated<AzureTag>>> {
    const option = continuationToken
      ? `&continuationToken=${continuationToken}`
      : '';
    const result = await super.getJson<AzureBodyPaginated<AzureTag>>(
      `${url}${option}`
    );
    if (result.headers['x-ms-continuationtoken']) {
      const nextResult = await this.getJsonPaginated(
        url,
        result.headers['x-ms-continuationtoken']
      );
      result.body.value.push(...nextResult.body.value);
    }
    return result;
  }
}
