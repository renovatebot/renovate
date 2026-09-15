import * as httpMock from '~test/http-mock.ts';
import { getActionsIdToken } from './oidc.ts';

describe('modules/platform/forgejo/oidc', () => {
  it('throws if the ID token request env vars are missing', async () => {
    await expect(getActionsIdToken('some-audience')).rejects.toThrow(
      'Init: forgejoOidcAudience is configured but the ACTIONS_ID_TOKEN_REQUEST_URL and ACTIONS_ID_TOKEN_REQUEST_TOKEN environment variables are missing. These variables are only available in Forgejo Actions workflows which set `enable-openid-connect: true`.',
    );
  });

  it('throws if only the ID token request URL is set', async () => {
    vi.stubEnv(
      'ACTIONS_ID_TOKEN_REQUEST_URL',
      'https://forgejo.example.com/api/actions_pipeline/id_token?api-version=2.0',
    );

    await expect(getActionsIdToken('some-audience')).rejects.toThrow(
      'Init: forgejoOidcAudience is configured but the ACTIONS_ID_TOKEN_REQUEST_URL and ACTIONS_ID_TOKEN_REQUEST_TOKEN environment variables are missing. These variables are only available in Forgejo Actions workflows which set `enable-openid-connect: true`.',
    );
  });

  it('throws if the ID token request URL is invalid', async () => {
    vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_URL', 'not-a-url');
    vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'some-request-token');

    await expect(getActionsIdToken('some-audience')).rejects.toThrow(
      'Init: ACTIONS_ID_TOKEN_REQUEST_URL is not a valid URL',
    );
  });

  it('returns the fetched ID token', async () => {
    vi.stubEnv(
      'ACTIONS_ID_TOKEN_REQUEST_URL',
      'https://forgejo.example.com/api/actions_pipeline/id_token?api-version=2.0',
    );
    vi.stubEnv('ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'some-request-token');
    httpMock
      .scope('https://forgejo.example.com', {
        reqheaders: { authorization: 'Bearer some-request-token' },
      })
      .get('/api/actions_pipeline/id_token')
      .query({ 'api-version': '2.0', audience: 'some-audience' })
      .reply(200, { value: 'some-id-token' });

    await expect(getActionsIdToken('some-audience')).resolves.toBe(
      'some-id-token',
    );
  });
});
