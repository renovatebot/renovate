import { beforeEach, describe, expect, it } from 'vitest';
import * as httpMock from '~test/http-mock.ts';
import { logger } from '~test/util.ts';
import { configureRejectUnauth, fetch, normalize } from './got.ts';
import { keepAliveAgents } from './keep-alive.ts';

describe('util/http/got', () => {
  // silence codeql warnings about unhandled promise rejections in got tests
  const rejectUnauth = 'NODE_TLS_REJECT_UNAUTHORIZED';

  beforeEach(() => {
    delete process.env[rejectUnauth];
  });

  it('configures rejectUnauthorized when forced', () => {
    process.env[rejectUnauth] = '0';
    const opts = {};
    configureRejectUnauth(opts);
    expect(opts).toEqual({ https: { rejectUnauthorized: false } });
    expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
      'NODE_TLS_REJECT_UNAUTHORIZED=0 found, this is strongly discouraged.',
    );
  });

  it('does a flat clone of options', async () => {
    httpMock.scope('https://example.com').get('/test').reply(200, 'ok');

    expect(normalize({ agent: keepAliveAgents }, []).agent).toStrictEqual(
      keepAliveAgents,
    );

    const resp = await fetch(
      'https://example.com/test',
      normalize(
        {
          method: 'GET',
          agent: keepAliveAgents,
          responseType: 'text',
          noAuth: true,
        },
        [],
      ),
      {
        queueMs: 0,
      },
    );

    expect(resp.body).toEqual('ok');
  });
});
