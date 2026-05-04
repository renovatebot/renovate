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
      expect(prettyStdout.getMeta(partial<BunyanRecord>())).toBeEmptyString();
    });

    it('returns empty string if no meta fields', () => {
      const rec = partial<BunyanRecord>({
        foo: 'bar',
      });
      expect(prettyStdout.getMeta(rec)).toBeEmptyString();
    });

    it('supports single meta', () => {
      const rec = partial<BunyanRecord>({
        foo: 'bar',
        repository: 'a/b',
      });
      expect(prettyStdout.getMeta(rec)).toEqual(
        util.styleText('gray', ' (repository=a/b)'),
      );
    });

    it('supports multi meta', () => {
      const rec = partial<BunyanRecord>({
        foo: 'bar',
        branch: 'c',
        repository: 'a/b',
        module: 'test',
      });
      expect(prettyStdout.getMeta(rec)).toEqual(
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
      expect(
        prettyStdout.getDetails(partial<BunyanRecord>()),
      ).toBeEmptyString();
    });

    it('returns empty string if all are meta fields', () => {
      const rec = partial<BunyanRecord>({
        branch: 'bar',
        v: 0,
      });
      expect(prettyStdout.getDetails(rec)).toBeEmptyString();
    });

    it('supports a config', () => {
      const rec = partial<BunyanRecord>({
        v: 0,
        config: {
          a: 'b',
          d: ['e', 'f'],
        },
      });
      expect(prettyStdout.getDetails(rec)).toBe(
        `       "config": {"a": "b", "d": ["e", "f"]}\n`,
      );
    });

    it('formats err.stack as readable multi-line output', () => {
      const rec = partial<BunyanRecord>({
        v: 0,
        err: {
          message: 'something broke',
          stack: 'Error: something broke\n    at foo (file.js:1:1)',
        },
      });
      expect(prettyStdout.getDetails(rec)).toBe(
        prettyStdout.indent(
          codeBlock`
            "err": {"message": "something broke"}
            Error: something broke
                at foo (file.js:1:1)
          `,
          true,
        ) + '\n',
      );
    });

    it('formats err.stack without other err fields', () => {
      const rec = partial<BunyanRecord>({
        v: 0,
        err: {
          stack: 'Error: oops\n    at bar (file.js:2:2)',
        },
      });
      expect(prettyStdout.getDetails(rec)).toBe(
        prettyStdout.indent(
          codeBlock`
            Error: oops
                at bar (file.js:2:2)
          `,
          true,
        ) + '\n',
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
    it('writes formatted data to stdout', () => {
      const stdoutSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);

      const stream = new prettyStdout.RenovateStream();
      const rec: BunyanRecord = {
        level: 10,
        msg: 'test message',
        v: 0,
      };

      stream.write(rec);
      expect(stdoutSpy).toHaveBeenCalledOnce();
      expect(stdoutSpy.mock.calls[0][0]).toContain('test message');
    });
  });
});
