import { Writable } from 'node:stream';
import { partial } from '~test/util.ts';
import { quickStringify } from '../util/stringify.ts';
import type { BunyanRecord, BunyanStream } from './types.ts';
import { withSanitizer } from './with-sanitizer.ts';

vi.mock('../util/stringify.ts');

const mockStringify = vi.mocked(quickStringify);

function makeWritableStream(): { output: string[]; writable: Writable } {
  const output: string[] = [];
  const writable = new Writable({
    write(chunk, _enc, cb) {
      output.push(chunk.toString());
      cb();
    },
  });
  return { output, writable };
}

function makeStream(
  writable: Writable,
  type: string,
): ReturnType<typeof withSanitizer> {
  return withSanitizer(partial<BunyanStream>({ stream: writable, type }));
}

function write(
  stream: ReturnType<typeof withSanitizer>,
  record: Partial<BunyanRecord>,
): void {
  (stream.stream as any).write(
    partial<BunyanRecord>({ level: 20, msg: 'test', ...record }),
    'utf8',
    vi.fn(),
  );
}

describe('logger/with-sanitizer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStringify.mockImplementation((val) => JSON.stringify(val));
  });

  it('throws on rotating-file type', () => {
    expect(() =>
      withSanitizer(partial<BunyanStream>({ type: 'rotating-file' })),
    ).toThrow("Rotating files aren't supported");
  });

  it('throws when stream and path are missing', () => {
    expect(() => withSanitizer(partial<BunyanStream>({}))).toThrow(
      "Missing 'stream' or 'path' for bunyan stream",
    );
  });

  it('stringifies and writes records', () => {
    const { output, writable } = makeWritableStream();
    const stream = makeStream(writable, 'stream');
    write(stream, { msg: 'hello' });
    expect(output).toHaveLength(1);
    expect(output[0]).toContain('"hello"');
  });

  it('passes record directly for raw type without stringifying', () => {
    const received: unknown[] = [];
    const rawWritable = {
      writable: true,
      write(chunk: unknown, _enc: BufferEncoding, cb: () => void) {
        received.push(chunk);
        cb();
      },
    };
    const stream = withSanitizer(
      partial<BunyanStream>({ stream: rawWritable as any, type: 'raw' }),
    );
    const record = partial<BunyanRecord>({ msg: 'raw record', level: 20 });
    (stream.stream as any).write(record, 'utf8', vi.fn());
    expect(received[0]).toMatchObject({ msg: 'raw record' });
    expect(mockStringify).not.toHaveBeenCalled();
  });

  it('truncates fields that are too large to serialize', () => {
    mockStringify
      .mockImplementationOnce(() => {
        throw new RangeError('Invalid string length');
      })
      .mockImplementation((val: unknown) => {
        if (val === 'huge-value') {
          throw new RangeError('Invalid string length');
        }
        return JSON.stringify(val);
      });

    const { output, writable } = makeWritableStream();
    const stream = makeStream(writable, 'stream');
    write(stream, { msg: 'test', bigField: 'huge-value' });

    expect(output).toHaveLength(1);
    const parsed = JSON.parse(output[0]);
    expect(parsed.msg).toBe('test');
    expect(parsed.bigField).toBe('[omitted: value too large to serialize]');
  });

  it('rethrows non-RangeError stringify failures', () => {
    mockStringify.mockImplementationOnce(() => {
      throw new TypeError('unexpected');
    });
    const { writable } = makeWritableStream();
    const stream = makeStream(writable, 'stream');
    expect(() => write(stream, { msg: 'test' })).toThrow(TypeError);
  });
});
