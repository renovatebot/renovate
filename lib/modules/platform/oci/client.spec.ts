import { createHash, generateKeyPair, verify } from 'node:crypto';
import { promisify } from 'node:util';
import { isString } from '@sindresorhus/is';
import { SimpleAuthenticationDetailsProvider } from 'oci-common';
import * as httpMock from '~test/http-mock.ts';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { OciClient } from './client.ts';

const { privateKey, publicKey } = await promisify(generateKeyPair)('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const provider = new SimpleAuthenticationDetailsProvider(
  'tenancy',
  'user',
  'fingerprint',
  privateKey,
  null,
);
const baseUrl = 'https://devops.eu-milan-1.oci.oraclecloud.com';
const endpoint = `${baseUrl}/20210630/`;

describe('modules/platform/oci/client', () => {
  it('signs the final encoded URL with the configured API key', async () => {
    const client = new OciClient(endpoint, provider);
    const scope = httpMock.scope(baseUrl);
    scope
      .get('/20210630/repositories?name=some+name')
      .reply(200, { id: 'repo' });

    const result = await client.get('repositories?name=some+name');

    expect(result.body).toEqual({ id: 'repo' });
  });

  it('produces a valid signature over the exact UTF-8 request body', async () => {
    const client = new OciClient(endpoint, provider);
    const body = { displayName: 'Update café ☕' };
    const serialized = JSON.stringify(body);
    const digest = createHash('sha256').update(serialized).digest('base64');
    const scope = httpMock.scope(baseUrl, {
      reqheaders: {
        'content-length': String(Buffer.byteLength(serialized)),
        'x-content-sha256': digest,
        'opc-retry-token': (value) => isString(value) && value.length === 36,
        authorization: (value) => value.startsWith('Signature version="1",'),
      },
    });
    let signatureValid = false;
    scope.on('request', (req) => {
      const headers = req.getHeaders();
      const authorization = String(headers.authorization);
      const parts = Object.fromEntries(
        authorization
          .slice('Signature '.length)
          .split(',')
          .map((part) => {
            const [key, ...rest] = part.trim().split('=');
            return [key, rest.join('=').slice(1, -1)];
          }),
      );
      const signingString = parts.headers
        .split(' ')
        .map((header) => {
          const value =
            header === '(request-target)'
              ? 'post /20210630/pullRequests'
              : headers[header.toLowerCase()];
          return `${header.toLowerCase()}: ${value}`;
        })
        .join('\n');
      signatureValid = verify(
        'RSA-SHA256',
        Buffer.from(signingString),
        publicKey,
        Buffer.from(parts.signature, 'base64'),
      );
    });
    scope.post('/20210630/pullRequests', body).reply(201, { id: 'pr' });

    await expect(client.post('pullRequests', body)).resolves.toMatchObject({
      body: { id: 'pr' },
    });

    expect(signatureValid).toBeTrue();
  });

  it('supports PUT, DELETE and empty POST bodies', async () => {
    const client = new OciClient(endpoint, provider);
    httpMock
      .scope(baseUrl)
      .put('/20210630/pullRequests/pr', { description: '' })
      .reply(200, { id: 'pr' })
      .post('/20210630/pullRequests/pr/actions/decline')
      .reply(200, {})
      .delete('/20210630/pullRequests/pr/comments/id')
      .reply(204);

    await expect(
      client.put('pullRequests/pr', { description: '' }),
    ).resolves.toMatchObject({ body: { id: 'pr' } });
    await expect(
      client.post('pullRequests/pr/actions/decline'),
    ).resolves.toMatchObject({ statusCode: 200 });
    await expect(
      client.delete('pullRequests/pr/comments/id'),
    ).resolves.toBeUndefined();
  });

  it('follows opaque page tokens while preserving filters', async () => {
    const client = new OciClient(endpoint, provider);
    httpMock
      .scope(baseUrl)
      .get('/20210630/pullRequests?repositoryId=repo')
      .reply(200, { items: ['a'] }, { 'opc-next-page': 'next+/=' })
      .get('/20210630/pullRequests?repositoryId=repo&page=next%2B%2F%3D')
      .reply(200, { items: ['b'] });

    await expect(
      client.list('pullRequests', { repositoryId: 'repo' }),
    ).resolves.toEqual(['a', 'b']);
  });

  it('reads raw file contents without JSON decoding', async () => {
    const client = new OciClient(endpoint, provider);
    httpMock.scope(baseUrl).get('/20210630/file').reply(200, 'plain text');

    await expect(client.getText('file')).resolves.toBe('plain text');
  });

  it('rejects repeated pagination tokens instead of looping forever', async () => {
    const client = new OciClient(endpoint, provider);
    httpMock
      .scope(baseUrl)
      .get('/20210630/pullRequests?repositoryId=repo')
      .reply(200, { items: [] }, { 'opc-next-page': 'repeat' })
      .get('/20210630/pullRequests?repositoryId=repo&page=repeat')
      .reply(200, { items: [] }, { 'opc-next-page': 'repeat' });

    await expect(
      client.list('pullRequests', { repositoryId: 'repo' }),
    ).rejects.toThrow('repeated page token');
  });

  it.each([429, 500, 503])(
    'classifies HTTP %s as a temporary platform failure',
    async (statusCode) => {
      const client = new OciClient(endpoint, provider);
      httpMock
        .scope(baseUrl)
        .post('/20210630/pullRequests')
        .reply(
          statusCode,
          { code: 'InternalError' },
          { 'opc-request-id': 'support-id' },
        );

      await expect(client.post('pullRequests')).rejects.toBeInstanceOf(
        ExternalHostError,
      );

      expect(logger.warn).toHaveBeenCalledWith(
        { statusCode, opcRequestId: 'support-id' },
        expect.stringContaining('OCI API request failed'),
      );
    },
  );

  it.each([429, 500])(
    'does not mistake a non-throwing HTTP %s lookup for missing data',
    async (statusCode) => {
      const client = new OciClient(endpoint, provider);
      httpMock
        .scope(baseUrl)
        .get('/20210630/file')
        .reply(
          statusCode,
          { code: 'InternalError' },
          { 'opc-request-id': 'support-id' },
        );

      await expect(
        client.get('file', { throwHttpErrors: false }),
      ).rejects.toBeInstanceOf(ExternalHostError);

      expect(logger.warn).toHaveBeenCalledWith(
        { statusCode, opcRequestId: 'support-id' },
        'OCI API lookup failed',
      );
    },
  );

  it('handles an outage without a request ID', async () => {
    const client = new OciClient(endpoint, provider);
    httpMock.scope(baseUrl).get('/20210630/file').reply(503, {});

    await expect(
      client.get('file', { throwHttpErrors: false }),
    ).rejects.toMatchObject({
      err: expect.objectContaining({
        message: expect.stringContaining('unavailable'),
      }),
    });
  });

  it('preserves failures without an HTTP response', async () => {
    const client = new OciClient(endpoint, provider);
    httpMock
      .scope(baseUrl)
      .get('/20210630/file')
      .replyWithError('connection failed');

    await expect(client.get('file')).rejects.toThrow('connection failed');
  });

  it('does not follow signed API redirects', async () => {
    const client = new OciClient(endpoint, provider);
    httpMock
      .scope(baseUrl)
      .get('/20210630/repositories')
      .reply(302, {}, { location: 'https://other.example/repositories' });

    await expect(client.get('repositories')).resolves.toMatchObject({
      statusCode: 302,
    });
  });

  it('propagates API authorization errors', async () => {
    const client = new OciClient(endpoint, provider);
    httpMock
      .scope(baseUrl)
      .get('/20210630/repositories')
      .reply(403, { code: 'NotAuthorizedOrNotFound' });

    await expect(client.get('repositories')).rejects.toThrow('403');
  });
});
