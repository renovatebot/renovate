import * as hostRules from '../util/host-rules';
import { Http } from '../util/http';
import errSerializer from './err-serializer';
import { sanitizeValue } from './utils';
import * as httpMock from '~test/http-mock';
import { partial } from '~test/util';

describe('logger/err-serializer', () => {
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
          authorization: 'Bearer testtoken',
        },
      },
    });
    expect(errSerializer(err)).toEqual({
      a: 1,
      b: 2,
      message: 'some message',
      response: {
        body: 'some response body',
        url: 'some/path',
      },
      options: {
        headers: {
          authorization: 'Bearer testtoken',
        },
      },
    });
  });

  it('handles missing fields', () => {
    const err = partial<Error & Record<string, unknown>>({
      a: 1,
      stack: 'foo',
      body: 'some body',
    });
    expect(errSerializer(err)).toEqual({
      a: 1,
      stack: 'foo',
      body: 'some body',
    });
  });

  describe('got', () => {
    const baseUrl = 'https://github.com';

    beforeEach(() => {
      // clean up hostRules
      hostRules.clear();
      hostRules.add({
        hostType: 'any',
        matchHost: baseUrl,
        token: 'token',
      });
    });

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

      expect(err).toBeDefined();

      // remove platform related props
      delete err.timings;
      delete err.stack;

      // sanitize like Bunyan
      expect(sanitizeValue(err)).toMatchSnapshot({
        name: 'HTTPError',
        options: {
          method: 'POST',
          password: '***********',
          url: 'https://**redacted**@github.com/api',
          username: '',
        },
      });
    });

    it('handles AggregateErrors', () => {
      const err = partial<Error & Record<string, unknown>>({
        message: 'foo',
        stack: 'error stack',
        body: 'error body',
      });
      const aggregateError = new AggregateError([err], 'bar');
      aggregateError.stack = 'aggregate stack';
      expect(errSerializer(aggregateError)).toEqual({
        message: 'bar',
        stack: 'aggregate stack',
        errors: [
          {
            message: 'foo',
            body: 'error body',
            stack: 'error stack',
          },
        ],
      });
    });
  });
});
