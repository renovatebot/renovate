import * as crypto from 'crypto';
import { Readable } from 'stream';
import { hash, hashStream, toSha256 } from './hash';

describe('util/hash', () => {
  it('hashes data with sha256', () => {
    expect(hash('https://example.com/test.txt', 'sha256')).toBe(
      'd1dc63218c42abba594fff6450457dc8c4bfdd7c22acf835a50ca0e5d2693020',
    );
    expect(toSha256('https://example.com/test.txt')).toBe(
      'd1dc63218c42abba594fff6450457dc8c4bfdd7c22acf835a50ca0e5d2693020',
    );
  });

  it('hashes data with sha512', () => {
    expect(hash('https://example.com/test.txt')).toBe(
      '368b1e723aecb5d17e0a69d046f8a7b9eb4e2aa2ee78e307d563c57cde45b8c3755990411aa2626c13214a8d571e0478fa9a19d03e295bb28bc453a88206b484',
    );
  });

  it('correctly hashes the content of a readable stream', async () => {
    const content = 'This is some test content.';
    const expectedHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    // Create a readable stream from the content
    const readableStream = new Readable();
    readableStream.push(content);
    readableStream.push(null);

    const actualHash = await hashStream(readableStream, 'sha256');

    expect(actualHash).toBe(expectedHash);
  });

  it('uses sha512 if no algorithm is specified', async () => {
    const content = 'This is some test content.';
    const expectedHash = crypto
      .createHash('sha512')
      .update(content)
      .digest('hex');
    // Create a readable stream from the content
    const readableStream = new Readable();
    readableStream.push(content);
    readableStream.push(null);

    const actualHash = await hashStream(readableStream);

    expect(actualHash).toBe(expectedHash);
  });
});
