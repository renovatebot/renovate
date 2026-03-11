import { parse } from './www-authenticate.ts';

describe('util/http/www-authenticate', () => {
  it.each([
    [
      'bearer',
      'Bearer realm="https://renovate.com/v2/token",service="container_registry",scope="*"',
      [
        {
          scheme: 'bearer',
          params: {
            realm: 'https://renovate.com/v2/token',
            scope: '*',
            service: 'container_registry',
          },
        },
      ],
    ],
    [
      'basic',
      'Basic realm="https://renovate.com/v2"',
      [
        {
          scheme: 'basic',
          params: {
            realm: 'https://renovate.com/v2',
          },
        },
      ],
    ],
    [
      'digest',
      'Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"',
      [
        {
          scheme: 'digest',
          params: {
            nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093',
            opaque: '5ccc069c403ebaf9f0171e9517f40e41',
            qop: 'auth,auth-int',
            realm: 'testrealm@host.com',
          },
        },
      ],
    ],
    [
      'negotiate',
      'Negotiate',
      [
        {
          scheme: 'negotiate',
        },
      ],
    ],
    [
      'negotiate with token',
      'Negotiate abc',
      [
        {
          scheme: 'negotiate',
          params: 'abc',
        },
      ],
    ],
    [
      'multiple challenges',
      'Bearer realm="https://renovate.com/v2/token",service="container_registry",scope="*"' +
        ',Basic realm="https://renovate.com/v2"',
      [
        {
          scheme: 'bearer',
          params: {
            realm: 'https://renovate.com/v2/token',
            scope: '*',
            service: 'container_registry',
          },
        },
        {
          scheme: 'basic',
          params: {
            realm: 'https://renovate.com/v2',
          },
        },
      ],
    ],
    [
      'multiple header',
      [
        'Bearer realm="https://renovate.com/v2/token",service="container_registry",scope="*"',
        'Basic realm="https://renovate.com/v2"',
      ],
      [
        {
          scheme: 'bearer',
          params: {
            realm: 'https://renovate.com/v2/token',
            scope: '*',
            service: 'container_registry',
          },
        },
        {
          scheme: 'basic',
          params: {
            realm: 'https://renovate.com/v2',
          },
        },
      ],
    ],
  ])('parses: %s', (_, value, result) => {
    const parsed = parse(value);
    expect(parsed).toEqual(result);
  });
});
