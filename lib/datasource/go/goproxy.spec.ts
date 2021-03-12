import * as httpMock from '../../../test/http-mock';
import { encodeCase, listVersions, versionInfo } from './goproxy';

describe('datasource/go/utils', () => {
  it('encodeCase', () => {
    expect(encodeCase('foo')).toBe('foo');
    expect(encodeCase('Foo')).toBe('!foo');
    expect(encodeCase('FOO')).toBe('!f!o!o');
  });

  describe('requests', () => {
    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    const baseUrl = 'https://proxy.golang.org';
    const lookupName = 'github.com/go-kit/kit';

    it('listVersions', async () => {
      httpMock.scope(baseUrl).get('/github.com/go-kit/kit/@v/list').reply(
        200,
        `
        v0.7.0
        v0.3.0
        v0.8.0
        v0.6.0
        v0.10.0
        v0.5.0
        v0.9.0
        v0.4.0
        v0.1.0
        v0.2.0
        `
      );

      const versions = await listVersions(baseUrl, lookupName);

      expect(versions).not.toBeEmpty();
      expect(versions).toHaveLength(10);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('versionInfo', async () => {
      httpMock
        .scope(baseUrl)
        .get('/github.com/go-kit/kit/@v/v0.5.0.info')
        .reply(200, { Version: 'v0.5.0', Time: '2017-06-08T17:28:36Z' });

      const release = await versionInfo(baseUrl, lookupName, 'v0.5.0');

      expect(release).toEqual({
        version: 'v0.5.0',
        releaseTimestamp: '2017-06-08T17:28:36Z',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
