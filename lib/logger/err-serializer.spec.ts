import * as httpMock from '../../test/http-mock';
import { getName, partial } from '../../test/util';
import * as hostRules from '../util/host-rules';
import { Http } from '../util/http';
import errSerializer from './err-serializer';
import { sanitizeValue } from './utils';

describe(getName(__filename), () => {
  it('expands errors', () => {
    const err = partial<Error & Record<string, unknown>>({
      a: 1,
      b: 2,
      message: 'some message',
      response: {
        body: 'some response body',
        url: 'some/path',
      },
      options: {
        headers: {
          authorization: 'Bearer abc',
        },
      },
    });
    expect(errSerializer(err)).toMatchSnapshot();
  });
  it('handles missing fields', () => {
    const err = partial<Error & Record<string, unknown>>({
      a: 1,
      stack: 'foo',
      body: 'some body',
    });
    expect(errSerializer(err)).toMatchSnapshot();
  });

  describe('got', () => {
    const baseUrl = 'https://github.com';

    beforeEach(() => {
      // reset module
      jest.resetAllMocks();
      httpMock.setup();
      // clean up hostRules
      hostRules.clear();
      hostRules.add({
        hostType: 'any',
        baseUrl,
        token: 'token',
      });
    });
    afterEach(() => httpMock.reset());

    it('handles http error', async () => {
      httpMock
        .scope(baseUrl)
        .post('/api')
        .reply(412, { err: { message: 'failed' } });
      let err: any;
      try {
        await new Http('any').postJson('https://:token@github.com/api');
      } catch (error) {
        err = errSerializer(error);
      }

      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(err).toBeDefined();
      expect(err.response.body).toBeDefined();
      expect(err.options).toBeDefined();
    });

    it('sanitize http error', async () => {
      httpMock
        .scope(baseUrl)
        .post('/api')
        .reply(412, { err: { message: 'failed' } });
      let err: any;
      try {
        await new Http('any').postJson('https://:token@github.com/api');
      } catch (error) {
        err = error;
      }

      expect(httpMock.getTrace()).toMatchSnapshot();
      expect(err).toBeDefined();

      // remove platform related props
      delete err.timings;
      delete err.stack;

      // sanitize like Bunyan
      expect(sanitizeValue(err)).toMatchSnapshot();
    });
  });
});
