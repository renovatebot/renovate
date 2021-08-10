declare module 'marshal' {
  class Marshal {
    public parsed?: unknown;

    constructor();
    constructor(buffer: Buffer);
    constructor(buffer: string, encoding: BufferEncoding);

    public load(buffer: Buffer): this;
    public load(buffer: string, encoding: BufferEncoding): this;

    public toString(encoding?: BufferEncoding): string;
    public toJSON(): unknown;
  }

  export default Marshal;
}
