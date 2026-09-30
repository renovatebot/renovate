import { request as httpRequest } from 'node:http';
import * as httpMock from './http-mock.ts';

interface RequestOptions {
  body?: string;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
}

function sendRequest(
  path: string,
  { body, headers, method = 'GET' }: RequestOptions = {},
): Promise<void> {
  return new Promise((resolve) => {
    const req = httpRequest(
      {
        headers,
        hostname: 'example.com',
        method,
        path,
      },
      (res) => {
        res.resume();
      },
    );
    req.on('close', () => setImmediate(resolve));
    req.on('error', () => undefined);
    req.end(body);
  });
}

function getClearError(): Error {
  try {
    httpMock.clear();
  } catch (err) {
    if (err instanceof Error) {
      return err;
    }
    throw err;
  }
  throw new Error('Expected HTTP mock cleanup to fail');
}

describe('http-mock', () => {
  it('fails when a mock is unused', () => {
    httpMock.scope('http://example.com').get('/unused').reply(200);

    expect(getClearError().message).toContain('*** Unused HTTP mocks ***');
  });

  it('fails after an unmatched request error is swallowed', async () => {
    await sendRequest('/missing', {
      body: JSON.stringify({ secret: 'missing-sensitive-body' }),
      headers: {
        authorization: 'Bearer missing-sensitive-token',
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    const message = getClearError().message;
    expect(message).toContain('*** Missing HTTP mocks ***');
    expect(message).toContain('- POST http://example.com/missing');
    expect(message).not.toContain('missing-sensitive-token');
    expect(message).not.toContain('missing-sensitive-body');
  });

  it('does not expose request headers or bodies in diagnostics', async () => {
    httpMock
      .scope('http://example.com')
      .post('/done')
      .reply(200)
      .get('/unused')
      .reply(200);

    await sendRequest('/done', {
      body: JSON.stringify({ secret: 'sensitive-body' }),
      headers: {
        authorization: 'Bearer sensitive-token',
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    const message = getClearError().message;
    expect(message).toContain('- POST http://example.com/done [200]');
    expect(message).not.toContain('sensitive-token');
    expect(message).not.toContain('sensitive-body');
  });

  it('can reset mocks without checking them', () => {
    httpMock.scope('http://example.com').get('/unused').reply(200);

    httpMock.clear(false);

    expect(httpMock.allUsed()).toBeTrue();
  });
});
