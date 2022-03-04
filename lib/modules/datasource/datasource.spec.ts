import * as httpMock from '../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { Datasource } from './datasource';
import type { GetReleasesConfig, ReleaseResult } from './types';

const exampleUrl = 'https://example.com/';

class TestDatasource extends Datasource {
  constructor() {
    super('test');
  }

  async getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult> {
    try {
      await this.http.get(exampleUrl);
    } catch (err) {
      this.handleGenericErrors(err);
    }
    return Promise.resolve(undefined);
  }
}

describe('modules/datasource/datasource', () => {
  it('should throw on 429', async () => {
    const testDatasource = new TestDatasource();

    httpMock.scope(exampleUrl).get('/').reply(429);

    await expect(testDatasource.getReleases(undefined)).rejects.toThrow(
      EXTERNAL_HOST_ERROR
    );
  });
});
