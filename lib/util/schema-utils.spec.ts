import { z } from 'zod';
import {
  looseArray,
  looseRecord,
  looseValue,
  parseJson,
  safeParseJson,
} from './schema-utils';

describe('util/schema-utils', () => {
  describe('looseArray', () => {
    it('parses array', () => {
      const s = looseArray(z.string());
      expect(s.parse(['foo', 'bar'])).toEqual(['foo', 'bar']);
    });

    it('handles non-array', () => {
      const s = looseArray(z.string());
      expect(s.parse({ foo: 'bar' })).toEqual([]);
    });

    it('drops wrong items', () => {
      const s = looseArray(z.string());
      expect(s.parse(['foo', 123, null, undefined, []])).toEqual(['foo']);
    });

    it('runs callback for wrong elements', () => {
      let called = false;
      const s = looseArray(z.string(), () => {
        called = true;
      });
      expect(s.parse(['foo', 123, 'bar'])).toEqual(['foo', 'bar']);
      expect(called).toBeTrue();
    });

    it('runs callback for non-array', () => {
      let called = false;
      const s = looseArray(z.string(), () => {
        called = true;
      });
      expect(s.parse('foobar')).toEqual([]);
      expect(called).toBeTrue();
    });
  });

  describe('looseRecord', () => {
    it('parses record', () => {
      const s = looseRecord(z.string());
      expect(s.parse({ foo: 'bar' })).toEqual({ foo: 'bar' });
    });

    it('handles non-record', () => {
      const s = looseRecord(z.string());
      expect(s.parse(['foo', 'bar'])).toEqual({});
    });

    it('drops wrong items', () => {
      const s = looseRecord(z.string());
      expect(s.parse({ foo: 'foo', bar: 123 })).toEqual({ foo: 'foo' });
    });

    it('runs callback for wrong elements', () => {
      let called = false;
      const s = looseRecord(z.string(), () => {
        called = true;
      });
      expect(s.parse({ foo: 'foo', bar: 123 })).toEqual({ foo: 'foo' });
      expect(called).toBeTrue();
    });

    it('runs callback for non-record', () => {
      let called = false;
      const s = looseRecord(z.string(), () => {
        called = true;
      });
      expect(s.parse('foobar')).toEqual({});
      expect(called).toBeTrue();
    });
  });

  describe('looseValue', () => {
    it('parses value', () => {
      const s = looseValue(z.string());
      expect(s.parse('foobar')).toBe('foobar');
    });

    it('falls back to null wrong value', () => {
      const s = looseValue(z.string());
      expect(s.parse(123)).toBeNull();
    });

    it('runs callback for wrong elements', () => {
      let called = false;
      const s = looseValue(z.string(), () => {
        called = true;
      });
      expect(s.parse(123)).toBeNull();
      expect(called).toBeTrue();
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

    it('parses ready data', () => {
      const res = parseJson({ foo: 'bar' }, z.object({ foo: z.string() }));
      expect(res).toEqual({ foo: 'bar' });
    });

    it('throws on invalid data', () => {
      expect(() => parseJson(null, z.object({ foo: z.string() }))).toThrow(
        z.ZodError
      );
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

    it('parses ready data', () => {
      const res = safeParseJson({ foo: 'bar' }, z.object({ foo: z.string() }));
      expect(res).toEqual({ foo: 'bar' });
    });

    it('returns null for invalid data', () => {
      expect(safeParseJson(42, z.object({ foo: z.string() }))).toBeNull();
    });
  });
});
