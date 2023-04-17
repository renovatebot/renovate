import { z } from 'zod';
import {
  Json,
  Json5,
  looseArray,
  looseRecord,
  looseValue,
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

  describe('Json', () => {
    it('parses json', () => {
      const Schema = Json.pipe(z.object({ foo: z.literal('bar') }));

      expect(Schema.parse('{"foo": "bar"}')).toEqual({ foo: 'bar' });

      expect(Schema.safeParse(42)).toMatchObject({
        error: {
          issues: [
            {
              message: 'Expected string, received number',
              code: 'invalid_type',
              expected: 'string',
              received: 'number',
              path: [],
            },
          ],
        },
        success: false,
      });

      expect(Schema.safeParse('{"foo": "foo"}')).toMatchObject({
        error: {
          issues: [
            {
              message: 'Invalid literal value, expected "bar"',
              code: 'invalid_literal',
              expected: 'bar',
              received: 'foo',
              path: ['foo'],
            },
          ],
        },
        success: false,
      });

      expect(Schema.safeParse('["foo", "bar"]')).toMatchObject({
        error: {
          issues: [
            {
              message: 'Expected object, received array',
              code: 'invalid_type',
              expected: 'object',
              received: 'array',
              path: [],
            },
          ],
        },
        success: false,
      });

      expect(Schema.safeParse('{{{}}}')).toMatchObject({
        error: {
          issues: [
            {
              message: 'Invalid JSON',
              code: 'custom',
              path: [],
            },
          ],
        },
        success: false,
      });
    });
  });

  describe('Json5', () => {
    it('parses JSON5', () => {
      const Schema = Json5.pipe(z.object({ foo: z.literal('bar') }));

      expect(Schema.parse('{"foo": "bar"}')).toEqual({ foo: 'bar' });

      expect(Schema.safeParse(42)).toMatchObject({
        error: {
          issues: [
            {
              message: 'Expected string, received number',
              code: 'invalid_type',
              expected: 'string',
              received: 'number',
              path: [],
            },
          ],
        },
        success: false,
      });

      expect(Schema.safeParse('{"foo": "foo"}')).toMatchObject({
        error: {
          issues: [
            {
              message: 'Invalid literal value, expected "bar"',
              code: 'invalid_literal',
              expected: 'bar',
              received: 'foo',
              path: ['foo'],
            },
          ],
        },
        success: false,
      });

      expect(Schema.safeParse('["foo", "bar"]')).toMatchObject({
        error: {
          issues: [
            {
              message: 'Expected object, received array',
              code: 'invalid_type',
              expected: 'object',
              received: 'array',
              path: [],
            },
          ],
        },
        success: false,
      });

      expect(Schema.safeParse('{{{}}}')).toMatchObject({
        error: {
          issues: [
            {
              message: 'Invalid JSON5',
              code: 'custom',
              path: [],
            },
          ],
        },
        success: false,
      });
    });
  });
});
