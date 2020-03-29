import nock from 'nock';
import { getConfigResponse } from '../../datasource/docker';

// TODO: move to datasource/docker ?
describe('getConfigResponse', () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('redirects correctly when the original and redirect url both have a port', async () => {
    const url =
      'http://docker.registry.com:5000/v2/image:latest/blobs/some-digest';
    const redirectURL =
      'https://s3.aws.amazon.com:3000/docker/registry/v2/blobs/sha256/d4/some-digest/data?X-Amz-Algorithm=AWS4-HMAC-SHA256';
    nock('http://docker.registry.com:5000')
      .get('/v2/image:latest/blobs/some-digest')
      .reply(307, undefined, {
        location: redirectURL,
      });
    nock('https://s3.aws.amazon.com:3000')
      .get(
        '/docker/registry/v2/blobs/sha256/d4/some-digest/data?X-Amz-Algorithm=AWS4-HMAC-SHA256'
      )
      .reply(200, 'test body');
    const response = await getConfigResponse(url, {});
    expect(response.body).toEqual('test body');
  });

  it('redirects correctly when original url has a port, but the redirect url does not', async () => {
    const url =
      'http://docker.registry.com:5001/v2/image:latest/blobs/some-digest';
    const redirectURL =
      'https://s3.aws.amazon.com/docker/registry/v2/blobs/sha256/d4/some-digest/data?X-Amz-Algorithm=AWS4-HMAC-SHA256';
    nock('http://docker.registry.com:5001')
      .get('/v2/image:latest/blobs/some-digest')
      .reply(307, undefined, {
        location: redirectURL,
      });
    nock('https://s3.aws.amazon.com')
      .get(
        '/docker/registry/v2/blobs/sha256/d4/some-digest/data?X-Amz-Algorithm=AWS4-HMAC-SHA256'
      )
      .reply(200, 'test body');
    const response = await getConfigResponse(url, {});
    expect(response.body).toEqual('test body');
  });

  it('redirects correctly when the original url does not have a port, but the redirect to url does', async () => {
    const url = 'http://docker.registry.com/v2/image:latest/blobs/some-digest';
    const redirectURL =
      'https://s3.aws.amazon.com:3001/docker/registry/v2/blobs/sha256/d4/some-digest/data?X-Amz-Algorithm=AWS4-HMAC-SHA256';
    nock('http://docker.registry.com')
      .get('/v2/image:latest/blobs/some-digest')
      .reply(307, undefined, {
        location: redirectURL,
      });
    nock('https://s3.aws.amazon.com:3001')
      .get(
        '/docker/registry/v2/blobs/sha256/d4/some-digest/data?X-Amz-Algorithm=AWS4-HMAC-SHA256'
      )
      .reply(200, 'test body');
    const response = await getConfigResponse(url, {});
    expect(response.body).toEqual('test body');
  });
});
