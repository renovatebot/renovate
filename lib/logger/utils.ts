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

  write(data: BunyanRecord) {
    const err = { ...data };
    for (const prop of excludeProps) delete err[prop];
    this._errors.push(err);
    return true;
  }

  getErrors() {
    return this._errors;
  }
}

function sanitizeObject(obj, seen = new WeakMap()) {
  const result = {};
  seen.set(obj, result);
  for (const [key, val] of Object.entries(obj)) {
    const valType = typeof val;
    if (valType === 'string') {
      result[key] = sanitize(val as string);
    } else if (val != null && valType !== 'function' && valType === 'object') {
      result[key] = seen.has(val as object)
        ? seen.get(val as object)
        : sanitizeObject(val, seen);
    } else {
      result[key] = val;
    }
  }
  seen.set(obj, result);
  return result;
}

export function withSanitizer(streamConfig): bunyan.Stream {
  if (streamConfig.type === 'rotating-file')
    throw new Error("Rotating files aren't supported");

  const stream = streamConfig.stream;
  if (stream && stream.writable) {
    const write = (chunk: BunyanRecord, enc, cb) => {
      const raw = sanitizeObject(chunk);
      const result =
        streamConfig.type === 'raw'
          ? raw
          : JSON.stringify(raw, bunyan.safeCycles());
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
