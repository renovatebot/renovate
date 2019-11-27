import fs from 'fs-extra';
import bunyan from 'bunyan';
import { Stream } from 'stream';
import { sanitize } from '../util/sanitize';

export interface BunyanRecord extends Record<string, any> {
  level: number;
  msg: string;
  module?: string;
}

const excludeProps = ['pid', 'time', 'v', 'hostname'];

export class ErrorStream extends Stream {
  private _errors: BunyanRecord[] = [];

  readable: boolean;

  writable: boolean;

  constructor() {
    super();
    this.readable = false;
    this.writable = true;
  }

  write(data: BunyanRecord): boolean {
    const err = { ...data };
    for (const prop of excludeProps) delete err[prop];
    this._errors.push(err);
    return true;
  }

  getErrors(): BunyanRecord[] {
    return this._errors;
  }
}

function sanitizeValue(value: any, seen = new WeakMap()): any {
  if (Array.isArray(value)) {
    const length = value.length;
    const arrayResult = Array(length);
    seen.set(value, arrayResult);
    for (let idx = 0; idx < length; idx += 1) {
      const val = value[idx];
      arrayResult[idx] = seen.has(val)
        ? seen.get(val)
        : sanitizeValue(val, seen);
    }
    return arrayResult;
  }

  const valueType = typeof value;

  if (value != null && valueType !== 'function' && valueType === 'object') {
    if (value instanceof Date) {
      return value;
    }

    const objectResult: Record<string, any> = {};
    seen.set(value, objectResult);
    for (const [key, val] of Object.entries<any>(value)) {
      objectResult[key] = seen.has(val)
        ? seen.get(val)
        : sanitizeValue(val, seen);
    }
    return objectResult;
  }

  return valueType === 'string' ? sanitize(value) : value;
}

export function withSanitizer(streamConfig): bunyan.Stream {
  if (streamConfig.type === 'rotating-file')
    throw new Error("Rotating files aren't supported");

  const stream = streamConfig.stream;
  if (stream && stream.writable) {
    const write = (chunk: BunyanRecord, enc, cb): void => {
      const raw = sanitizeValue(chunk);
      const result =
        streamConfig.type === 'raw'
          ? raw
          : JSON.stringify(raw, bunyan.safeCycles()).replace(/\n?$/, '\n');
      stream.write(result, enc, cb);
    };

    return {
      ...streamConfig,
      type: 'raw',
      stream: { write },
    };
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
