import { z } from 'zod';
import {
  LooseArray,
  LooseRecord,
  parseJson,
  safeParseJson,
} from './schema-utils';

describe('util/schema-utils', () => {
  describe('LooseArray', () => {
    it('parses array', () => {
      const s = LooseArray(z.string());
      expect(s.parse(['foo', 'bar'])).toEqual(['foo', 'bar']);
    });

    it('drops wrong items', () => {
      const s = LooseArray(z.string());
      expect(s.parse(['foo', 123, null, undefined, []])).toEqual(['foo']);
    });

    it('runs callback for wrong elements', () => {
      let err: z.ZodError | undefined = undefined;
      const Schema = LooseArray(z.string(), {
        onError: ({ error }) => {
          err = error;
        },
      });

      const res = Schema.parse(['foo', 123, 'bar']);

      expect(res).toEqual(['foo', 'bar']);
      expect(err).toMatchObject({
        issues: [
          {
            message: 'Expected string, received number',
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: [1],
          },
        ],
      });
    });
  });

  describe('LooseRecord', () => {
    it('parses record', () => {
      const s = LooseRecord(z.string());
      expect(s.parse({ foo: 'bar' })).toEqual({ foo: 'bar' });
    });

    it('drops wrong items', () => {
      const s = LooseRecord(z.string());
      expect(s.parse({ foo: 'foo', bar: 123 })).toEqual({ foo: 'foo' });
    });

    it('runs callback for wrong elements', () => {
      let err: z.ZodError | undefined = undefined;
      const Schema = LooseRecord(
        z.object({ foo: z.object({ bar: z.string() }) }),
        {
          onError: ({ error }) => {
            err = error;
          },
        }
      );

      const res = Schema.parse({
        aaa: { foo: { bar: 42 } },
        bbb: { foo: { baz: 'asdf' } },
        ccc: { foo: { bar: 'baz' } },
      });

      expect(res).toEqual({ ccc: { foo: { bar: 'baz' } } });
      expect(err).toMatchObject({
        issues: [
          {
            message: 'Expected string, received number',
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['aaa', 'foo', 'bar'],
          },
          {
            message: 'Required',
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['bbb', 'foo', 'bar'],
          },
        ],
      });
    });
  });

  describe('parseJson', () => {
    it('parses json', () => {
      const res = parseJson('{"foo": "bar"}', z.object({ foo: z.string() }));
      expect(res).toEqual({ foo: 'bar' });
    });

    it('throws on invalid json', () => {
      expect(() =>
        parseJson('{"foo": "bar"', z.object({ foo: z.string() }))
      ).toThrow(SyntaxError);
    });

    it('throws on invalid schema', () => {
      expect(() =>
        parseJson('{"foo": "bar"}', z.object({ foo: z.number() }))
      ).toThrow(z.ZodError);
    });
  });

  describe('safeParseJson', () => {
    it('parses json', () => {
      const res = safeParseJson(
        '{"foo": "bar"}',
        z.object({ foo: z.string() })
      );
      expect(res).toEqual({ foo: 'bar' });
    });

    it('returns null on invalid json', () => {
      const res = safeParseJson('{"foo": "bar"', z.object({ foo: z.string() }));
      expect(res).toBeNull();
    });

    it('returns null on invalid schema', () => {
      const res = safeParseJson(
        '{"foo": "bar"}',
        z.object({ foo: z.number() })
      );
      expect(res).toBeNull();
    });

    it('runs callback on invalid json', () => {
      const callback = jest.fn();
      safeParseJson('{"foo": "bar"', z.object({ foo: z.string() }), callback);
      expect(callback).toHaveBeenCalledWith(expect.any(SyntaxError));
    });

    it('runs callback on invalid schema', () => {
      const callback = jest.fn();
      safeParseJson('{"foo": "bar"}', z.object({ foo: z.number() }), callback);
      expect(callback).toHaveBeenCalledWith(expect.any(z.ZodError));
    });
  });
});
