import { z } from 'zod';
import { logger } from '../../test/util';
import * as memCache from './cache/memory';
import * as schema from './schema';

describe('util/schema', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    memCache.init();
  });

  it('validates data', () => {
    const testSchema = z.object({ foo: z.string() });
    const validData = { foo: 'bar' };

    const res = schema.match(testSchema, validData);
    expect(res).toBeTrue();
  });

  it('returns false for invalid data', () => {
    const testSchema = z.object({ foo: z.string() });
    const invalidData = { foo: 123 };

    const res = schema.match(testSchema, invalidData);
    expect(res).toBeFalse();

    schema.reportErrors();
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  describe('warn', () => {
    it('reports nothing if there are no any reports', () => {
      schema.reportErrors();
      expect(logger.logger.warn).not.toHaveBeenCalled();
    });

    it('reports same warning one time', () => {
      const testSchema = z.object(
        { foo: z.string() },
        { description: 'Some test schema' }
      );
      const invalidData = { foo: 42 };

      schema.match(testSchema, invalidData, 'warn');
      schema.match(testSchema, invalidData, 'warn');
      schema.match(testSchema, invalidData, 'warn');
      schema.match(testSchema, invalidData, 'warn');
      schema.reportErrors();

      expect(logger.logger.warn).toHaveBeenCalledOnce();
      expect(logger.logger.warn.mock.calls[0]).toMatchObject([
        { description: 'Some test schema' },
        'Schema validation error',
      ]);
    });

    it('reports unspecified schema', () => {
      const testSchema = z.object({ foo: z.string() });
      const invalidData = { foo: 42 };

      schema.match(testSchema, invalidData, 'warn');
      schema.reportErrors();

      expect(logger.logger.warn).toHaveBeenCalledOnce();
      expect(logger.logger.warn.mock.calls[0]).toMatchObject([
        { description: 'Unspecified schema' },
        'Schema validation error',
      ]);
    });
  });

  describe('throw', () => {
    it('throws for invalid data', () => {
      const testSchema = z.object({
        foo: z.string({ invalid_type_error: 'foobar' }),
      });
      const invalidData = { foo: 123 };

      expect(() => schema.match(testSchema, invalidData, 'throw')).toThrow(
        'foobar'
      );
    });
  });

  describe('looseArray', () => {
    it('parses array', () => {
      const s = schema.looseArray(z.string());
      expect(s.parse(['foo', 'bar'])).toEqual(['foo', 'bar']);
    });

    it('handles non-array', () => {
      const s = schema.looseArray(z.string());
      expect(s.parse({ foo: 'bar' })).toEqual([]);
    });

    it('drops wrong items', () => {
      const s = schema.looseArray(z.string());
      expect(s.parse(['foo', 123, null, undefined, []])).toEqual(['foo']);
    });

    it('runs callback for wrong elements', () => {
      let called = false;
      const s = schema.looseArray(z.string(), () => {
        called = true;
      });
      expect(s.parse(['foo', 123, 'bar'])).toEqual(['foo', 'bar']);
      expect(called).toBeTrue();
    });

    it('runs callback for non-array', () => {
      let called = false;
      const s = schema.looseArray(z.string(), () => {
        called = true;
      });
      expect(s.parse('foobar')).toEqual([]);
      expect(called).toBeTrue();
    });
  });

  describe('looseRecord', () => {
    it('parses record', () => {
      const s = schema.looseRecord(z.string());
      expect(s.parse({ foo: 'bar' })).toEqual({ foo: 'bar' });
    });

    it('handles non-record', () => {
      const s = schema.looseRecord(z.string());
      expect(s.parse(['foo', 'bar'])).toEqual({});
    });

    it('drops wrong items', () => {
      const s = schema.looseRecord(z.string());
      expect(s.parse({ foo: 'foo', bar: 123 })).toEqual({ foo: 'foo' });
    });

    it('runs callback for wrong elements', () => {
      let called = false;
      const s = schema.looseRecord(z.string(), () => {
        called = true;
      });
      expect(s.parse({ foo: 'foo', bar: 123 })).toEqual({ foo: 'foo' });
      expect(called).toBeTrue();
    });

    it('runs callback for non-record', () => {
      let called = false;
      const s = schema.looseRecord(z.string(), () => {
        called = true;
      });
      expect(s.parse('foobar')).toEqual({});
      expect(called).toBeTrue();
    });
  });

  describe('looseValue', () => {
    it('parses value', () => {
      const s = schema.looseValue(z.string());
      expect(s.parse('foobar')).toBe('foobar');
    });

    it('falls back to null wrong value', () => {
      const s = schema.looseValue(z.string());
      expect(s.parse(123)).toBeNull();
    });

    it('runs callback for wrong elements', () => {
      let called = false;
      const s = schema.looseValue(z.string(), () => {
        called = true;
      });
      expect(s.parse(123)).toBeNull();
      expect(called).toBeTrue();
    });
  });

  describe('looseObject', () => {
    it('parses object', () => {
      const s = schema.looseObject({
        foo: z.string(),
        bar: z.number(),
      });
      expect(s.parse({ foo: 'foo', bar: 123 })).toEqual({
        foo: 'foo',
        bar: 123,
      });
    });

    it('drops wrong items', () => {
      const s = schema.looseObject({
        foo: z.string(),
        bar: z.number(),
        baz: z.string(),
      });
      expect(s.parse({ foo: 'foo', bar: 'bar' })).toEqual({
        foo: 'foo',
        bar: null,
      });
    });
  });
});
