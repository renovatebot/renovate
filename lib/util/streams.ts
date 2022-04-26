import { Blob } from 'buffer';
import { Readable } from 'stream';
import ReadableStream = NodeJS.ReadableStream;

export async function streamToString(
  stream: Readable | ReadableStream | Blob
): Promise<string> {
  if (stream instanceof Blob) {
    return stream.text();
  }
  const readable = Readable.from(stream);
  const chunks: Uint8Array[] = [];
  const p = await new Promise<string>((resolve, reject) => {
    readable.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    readable.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    readable.on('error', (err) => reject(err));
  });
  return p;
}
