import { Readable } from 'node:stream';

export async function streamToString(
  stream: NodeJS.ReadableStream,
): Promise<string> {
  const readable = Readable.from(stream);
  const chunks: Uint8Array[] = [];
  const p = await new Promise<string>((resolve, reject) => {
    readable.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    readable.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    readable.on('error', (err) => reject(err));
  });
  return p;
}
