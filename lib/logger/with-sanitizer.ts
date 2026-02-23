import fs from 'fs-extra';
import { regEx } from '../util/regex.ts';
import { quickStringify } from '../util/stringify.ts';
import type { BunyanNodeStream, BunyanRecord, BunyanStream } from './types.ts';
import { sanitizeValue } from './utils.ts';

export function withSanitizer(streamConfig: BunyanStream): BunyanStream {
  if (streamConfig.type === 'rotating-file') {
    throw new Error("Rotating files aren't supported");
  }

  const stream = streamConfig.stream as BunyanNodeStream;
  if (stream?.writable) {
    const write = (
      chunk: BunyanRecord,
      enc: BufferEncoding,
      cb: (err?: Error | null) => void,
    ): void => {
      const raw = sanitizeValue(chunk);
      const result =
        streamConfig.type === 'raw'
          ? raw
          : quickStringify(raw)?.replace(regEx(/\n?$/), '\n');
      stream.write(result, enc, cb);
    };

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
