import { Stream } from 'stream';

export interface BunyanRecord extends Record<string, any> {
  level: number;
  msg: string;
  module?: string;
}

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
    this._errors.push(data);
    return true;
  }

  getErrors() {
    return this._errors;
  }
}
