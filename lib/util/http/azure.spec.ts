import * as httpMock from '../../../test/http-mock';
import { AzureHttp } from './azure';

const azureApiHost = 'https://dev.azure.com';

describe('util/http/azure', () => {
  let azureApi: AzureHttp;

  beforeEach(() => {
    azureApi = new AzureHttp();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('gets paginated json', async () => {
    httpMock
      .scope(azureApiHost)
      .get('/some-org/some-project/some-path?$top=2')
      .reply(200, { value: ['a', 'b'] }, { 'x-ms-continuationtoken': '1' })
      .get('/some-org/some-project/some-path?$top=2&continuationToken=1')
      .reply(200, { value: ['c', 'd'] }, { 'x-ms-continuationtoken': '2' })
      .get('/some-org/some-project/some-path?$top=2&continuationToken=2')
      .reply(200, { value: ['e'] });
    const res = await azureApi.getJsonPaginated(
      'https://dev.azure.com/some-org/some-project/some-path?$top=2'
    );
    expect(res.body.value).toHaveLength(5);
  });
});
