import { beforeEach, describe, expect, it } from 'vitest';
import { logger } from '~test/util.ts';
import { configureRejectUnauth } from './got.ts';

describe('util/http/got', () => {
  beforeEach(() => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  });

  it('configures rejectUnauthorized when forced', () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const opts = {};
    configureRejectUnauth(opts);
    expect(opts).toEqual({ https: { rejectUnauthorized: false } });
    expect(logger.logger.once.warn).toHaveBeenCalledExactlyOnceWith(
      'NODE_TLS_REJECT_UNAUTHORIZED=0 found, this is strongly discuraged.',
    );
  });
});
