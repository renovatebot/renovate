import { Stream } from 'stream';

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
