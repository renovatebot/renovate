import { beforeEach, describe, expect, it } from 'vitest';
import { logger } from '~test/util.ts';
import { configureRejectUnauth } from './got.ts';

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
      'NODE_TLS_REJECT_UNAUTHORIZED=0 found, this is strongly discuraged.',
    );
  });
});
