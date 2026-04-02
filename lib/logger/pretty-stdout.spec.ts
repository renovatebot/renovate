import * as util from 'node:util';
import { codeBlock } from 'common-tags';
import { partial } from '~test/util.ts';
import * as prettyStdout from './pretty-stdout.ts';
import type { BunyanRecord } from './types.ts';

describe('logger/pretty-stdout', () => {
  describe('getMeta(rec)', () => {
    it('returns empty string if null rec', () => {
      expect(prettyStdout.getMeta(null as any)).toBeEmptyString();
    });

    it('returns empty string if empty rec', () => {
      expect(prettyStdout.getMeta({} as any)).toBeEmptyString();
    });

    it('returns empty string if no meta fields', () => {
      const rec = {
        foo: 'bar',
      };
      expect(prettyStdout.getMeta(rec as any)).toBeEmptyString();
    });

    it('supports single meta', () => {
      const rec = {
        foo: 'bar',
        repository: 'a/b',
      };
      expect(prettyStdout.getMeta(rec as any)).toEqual(
        util.styleText('gray', ' (repository=a/b)'),
      );
    });

    it('supports multi meta', () => {
      const rec = {
        foo: 'bar',
        branch: 'c',
        repository: 'a/b',
        module: 'test',
      };
      expect(prettyStdout.getMeta(rec as any)).toEqual(
        util.styleText('gray', ' (repository=a/b, branch=c) [test]'),
      );
    });

    it('returns plain text when colorize is false', () => {
      const rec = partial<BunyanRecord>({
        foo: 'bar',
        repository: 'a/b',
        module: 'test',
      });
      expect(prettyStdout.getMeta(rec, false)).toBe(' (repository=a/b) [test]');
    });
  });

  describe('getDetails(rec)', () => {
    it('returns empty string if null rec', () => {
      expect(prettyStdout.getDetails(null as any)).toBeEmptyString();
    });

    it('returns empty string if empty rec', () => {
      expect(prettyStdout.getDetails({} as any)).toBeEmptyString();
    });

    it('returns empty string if all are meta fields', () => {
      const rec = {
        branch: 'bar',
        v: 0,
      };
      expect(prettyStdout.getDetails(rec as any)).toBeEmptyString();
    });

    it('supports a config', () => {
      const rec = {
        v: 0,
        config: {
          a: 'b',
          d: ['e', 'f'],
        },
      };
      expect(prettyStdout.getDetails(rec as any)).toBe(
        `       "config": {"a": "b", "d": ["e", "f"]}\n`,
      );
    });
  });

  describe('formatRecord(rec)', () => {
    beforeEach(() => {
      process.env.FORCE_COLOR = '1';
    });

    afterEach(() => {
      delete process.env.FORCE_COLOR;
    });

    it('formats record', () => {
      const rec: BunyanRecord = {
        level: 10,
        msg: 'test message',
        v: 0,
        config: {
          a: 'b',
          d: ['e', 'f'],
        },
      };
      expect(prettyStdout.formatRecord(rec)).toEqual(
        [
          `TRACE: test message`,
          `       "config": {"a": "b", "d": ["e", "f"]}`,
          ``,
        ].join('\n'),
      );
    });

    it('formats record without colors', () => {
      const rec = partial<BunyanRecord>({
        level: 10,
        msg: 'test message',
        v: 0,
        config: {
          a: 'b',
          d: ['e', 'f'],
        },
      });
      expect(prettyStdout.formatRecord(rec, false)).toEqual(
        codeBlock`
          TRACE: test message
                 "config": {"a": "b", "d": ["e", "f"]}
        ` + '\n',
      );
    });
  });

  describe('RenovateStream', () => {
    it('writes formatted data to destination', () => {
      const chunks: string[] = [];
      const destination = partial<NodeJS.WritableStream>({
        write: (chunk: string) => {
          chunks.push(chunk);
          return true;
        },
      });

      const stream = new prettyStdout.RenovateStream(destination);
      const rec: BunyanRecord = {
        level: 10,
        msg: 'test message',
        v: 0,
      };

      stream.write(rec);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('test message');
    });

    it('writes without colors when colorize is false', () => {
      const chunks: string[] = [];
      const destination = partial<NodeJS.WritableStream>({
        write: (chunk: string) => {
          chunks.push(chunk);
          return true;
        },
      });

      const stream = new prettyStdout.RenovateStream(destination, {
        colorize: false,
      });
      const rec: BunyanRecord = {
        level: 10,
        msg: 'test message',
        v: 0,
      };

      stream.write(rec);
      expect(chunks).toEqual(['TRACE: test message\n']);
    });
  });
});
