import fs from 'fs-extra';
import { regEx } from '../util/regex.ts';
import { quickStringify } from '../util/stringify.ts';
import type { BunyanNodeStream, BunyanRecord, BunyanStream } from './types.ts';
import { sanitizeValue } from './utils.ts';

function truncateLargeFields(record: BunyanRecord): BunyanRecord {
  const result: BunyanRecord = { ...record };
  for (const key of Object.keys(result)) {
    try {
      quickStringify(result[key]);
    } catch (err) {
      if (err instanceof RangeError) {
        result[key] = '[omitted: value too large to serialize]';
      }
    }
  }
  return result;
}

export function withSanitizer(streamConfig: BunyanStream): BunyanStream {
  if (streamConfig.type === 'rotating-file') {
    throw new Error("Rotating files aren't supported");
  }

  const stream = streamConfig.stream as BunyanNodeStream;
  if (stream?.writable) {
    function write(
      chunk: BunyanRecord,
      enc: BufferEncoding,
      cb: (err?: Error | null) => void,
    ): void {
      const raw = sanitizeValue(chunk);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      let result = raw;
      if (streamConfig.type !== 'raw') {
        let serialized: string | undefined;
        try {
          serialized = quickStringify(raw);
        } catch (err) {
          if (err instanceof RangeError) {
            serialized = quickStringify(truncateLargeFields(raw));
          } else {
            throw err;
          }
        }
        result = serialized?.replace(regEx(/\n?$/), '\n');
      }
      stream.write(result, enc, cb);
    }

    return {
      ...streamConfig,
      type: 'raw',
      stream: { write },
    } as BunyanStream;
  }

  if (streamConfig.path) {
    const fileStream = fs.createWriteStream(streamConfig.path, {
      flags: 'a',
      encoding: 'utf8',
    });

    return withSanitizer({ ...streamConfig, stream: fileStream });
  }

  throw new Error("Missing 'stream' or 'path' for bunyan stream");
}
