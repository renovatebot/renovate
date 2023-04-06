import { z } from 'zod';
import * as schema from './schema-utils';

describe('util/schema-utils', () => {
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
});
