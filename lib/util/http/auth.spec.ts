import { NormalizedOptions } from 'got';
import { getName, partial } from '../../../test/util';
import { removeAuthorization } from './auth';

describe(getName(__filename), () => {
  it('removeAuthorization no authorization', () => {
    const opts = {
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    };

    removeAuthorization(partial<NormalizedOptions>(opts));

    expect(opts).toEqual({
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    });
  });

  it('removeAuthorization Amazon', () => {
    const opts = {
      password: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    };

    removeAuthorization(partial<NormalizedOptions>(opts));

    expect(opts).toEqual({
      headers: {},
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    });
  });

  it('removeAuthorization Amazon ports', () => {
    const opts = {
      password: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      port: 3000,
      search: 'something X-Amz-Algorithm something',
    };

    removeAuthorization(partial<NormalizedOptions>(opts));

    expect(opts).toEqual({
      headers: {},
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    });
  });

  it('removeAuthorization Azure blob', () => {
    const opts = {
      password: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'store123.blob.core.windows.net',
      href:
        'https://<store>.blob.core.windows.net/<some id>//docker/registry/v2/blobs',
    };

    removeAuthorization(partial<NormalizedOptions>(opts));

    expect(opts).toEqual({
      headers: {},
      hostname: 'store123.blob.core.windows.net',
      href:
        'https://<store>.blob.core.windows.net/<some id>//docker/registry/v2/blobs',
    });
  });

  it('removeAuthorization keep auth', () => {
    const opts = {
      password: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'renovate.com',
      href: 'https://renovate.com',
      search: 'something',
    };

    removeAuthorization(partial<NormalizedOptions>(opts));

    expect(opts).toEqual({
      password: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'renovate.com',
      href: 'https://renovate.com',
      search: 'something',
    });
  });
});
