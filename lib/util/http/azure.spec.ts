import * as httpMock from '../../../test/http-mock';
import { AzureHttp, setBaseUrl } from './azure';
import { hostRules } from '~test/util';

const azureApiHost = 'https://dev.azure.com/';

describe('util/http/azure', () => {
  let azureApi: AzureHttp;

  beforeEach(() => {
    azureApi = new AzureHttp();
    setBaseUrl(azureApiHost);

    hostRules.clear();
    hostRules.add({
      hostType: 'azure',
      matchHost: azureApiHost,
      token: 'some-token',
    });
  });

  afterEach(() => {
    httpMock.clear(false);
  });

  it('gets paginated JSON', async () => {
    const valuesPageOne = ['a', 'b'];
    const valuesPageTwo = ['c', 'd'];
    const valuesPageThree = ['e'];

    httpMock
      .scope(azureApiHost)
      .get('/some-org/some-project/some-path?%24top=2')
      .reply(200, { value: valuesPageOne }, { 'x-ms-continuationtoken': '1' })
      .get('/some-org/some-project/some-path?%24top=2&continuationToken=1')
      .reply(200, { value: valuesPageTwo }, { 'x-ms-continuationtoken': '2' })
      .get('/some-org/some-project/some-path?%24top=2&continuationToken=2')
      .reply(200, { value: valuesPageThree });
    const res = await azureApi.getJsonUnchecked(
      'https://dev.azure.com/some-org/some-project/some-path',
      {
        paginate: true,
        limit: 2,
      },
    );
    expect(res.body).toEqual({
      value: [...valuesPageOne, ...valuesPageTwo, ...valuesPageThree],
    });
  });
});
