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

  it('gets paginated JSON', async () => {
    const valuesPageOne = ['a', 'b'];
    const valuesPageTwo = ['c', 'd'];
    const valuesPageThree = ['e'];

    httpMock
      .scope(azureApiHost)
      .get('/some-org/some-project/some-path?$top=2')
      .reply(200, { value: valuesPageOne }, { 'x-ms-continuationtoken': '1' })
      .get('/some-org/some-project/some-path?$top=2&continuationToken=1')
      .reply(200, { value: valuesPageTwo }, { 'x-ms-continuationtoken': '2' })
      .get('/some-org/some-project/some-path?$top=2&continuationToken=2')
      .reply(200, { value: valuesPageThree });
    const res = await azureApi.getJson(
      'https://dev.azure.com/some-org/some-project/some-path?$top=2'
    );
    expect(res.body).toEqual({
      value: [...valuesPageOne, ...valuesPageTwo, ...valuesPageThree],
    });
  });
});
