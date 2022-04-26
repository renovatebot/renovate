import { Blob } from 'buffer';
import { Readable } from 'stream';

export async function streamToString(
  stream: Readable | NodeJS.ReadableStream | ReadableStream | Blob
): Promise<string> {
  if (stream instanceof Blob) {
    return stream.text();
  }

  // istanbul ignore if
  if (stream instanceof ReadableStream) {
    const readerResult = await stream.getReader().read();
    const readerValue = readerResult.value;
    return `${readerValue ?? ''}`;
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
