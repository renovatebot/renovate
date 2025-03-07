import * as httpMock from '../../../test/http-mock';
import { ScmManagerHttp, setBaseUrl } from './scm-manager';

describe('util/http/scm-manager', () => {
  const baseUrl = 'http://localhost:8080/scm/api/v2';
  let scmManagerHttp: ScmManagerHttp;

  beforeEach(() => {
    scmManagerHttp = new ScmManagerHttp();
    setBaseUrl(baseUrl);
  });

  it('supports custom accept header', async () => {
    const expectedAcceptHeader = 'application/vnd.scmm-me+json;v=2';
    httpMock
      .scope(baseUrl, {
        reqheaders: {
          accept: expectedAcceptHeader,
        },
      })
      .get('/example')
      .reply(200);

    const response = await scmManagerHttp.getJsonUnchecked('example', {
      scmmContentType: expectedAcceptHeader,
    });

    expect(response.statusCode).toEqual(200);
  });
});
