import fs from 'fs-extra';
import bunyan from 'bunyan';
import { Stream, Writable } from 'stream';
import { sanitize } from '../util/host-rules';

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

export function withSanitizer(streamConfig): bunyan.Stream {
  const stream = streamConfig.stream;
  if (stream && stream.writable) {
    const stream = streamConfig.stream;

    const write = (chunk, enc, cb) => {
      let value;
      try {
        const sanitized = sanitize(chunk);
        value = streamConfig.type === 'raw' ? JSON.parse(sanitized) : sanitized;
      } catch (e) {
        // FIXME: write something anyway?
        value = streamConfig.type === 'raw' ? {} : '{}';
      }
      stream.write(value, enc, cb);
      cb();
    };

    return {
      ...streamConfig,
      type: 'stream',
      stream: new Writable({ write }),
    };
  } else if (streamConfig.path && streamConfig.type !== 'rotating-file') {
    // Rotating files aren't supported well

    const stream = fs.createWriteStream(streamConfig.path, {
      flags: 'a',
      encoding: 'utf8',
    });

    return withSanitizer({ ...streamConfig, stream });
  }

  // FIXME: dummy stream maybe?
  throw new Error("Can't create sanitized stream");
}
