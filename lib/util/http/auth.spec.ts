import { getName } from '../../../test/util';
import { removeAuthorization } from './auth';

describe(getName(__filename), () => {
  it('removeAuthorization no authorization', () => {
    const opts = {
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    };

    removeAuthorization(opts);

    expect(opts).toEqual({
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    });
  });

  it('removeAuthorization Amazon', () => {
    const opts = {
      auth: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    };

    removeAuthorization(opts);

    expect(opts).toEqual({
      headers: {},
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    });
  });

  it('removeAuthorization Amazon ports', () => {
    const opts = {
      auth: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      port: 3000,
      search: 'something X-Amz-Algorithm something',
    };

    removeAuthorization(opts);

    expect(opts).toEqual({
      headers: {},
      hostname: 'amazon.com',
      href: 'https://amazon.com',
      search: 'something X-Amz-Algorithm something',
    });
  });

  it('removeAuthorization Azure blob', () => {
    const opts = {
      auth: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'store123.blob.core.windows.net',
      href:
        'https://<store>.blob.core.windows.net/<some id>//docker/registry/v2/blobs',
    };

    removeAuthorization(opts);

    expect(opts).toEqual({
      headers: {},
      hostname: 'store123.blob.core.windows.net',
      href:
        'https://<store>.blob.core.windows.net/<some id>//docker/registry/v2/blobs',
    });
  });

  it('removeAuthorization keep auth', () => {
    const opts = {
      auth: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'renovate.com',
      href: 'https://renovate.com',
      search: 'something',
    };

    removeAuthorization(opts);

    expect(opts).toEqual({
      auth: 'auth',
      headers: {
        authorization: 'auth',
      },
      hostname: 'renovate.com',
      href: 'https://renovate.com',
      search: 'something',
    });
  });
});
