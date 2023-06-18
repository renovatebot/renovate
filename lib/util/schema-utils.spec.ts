import { z } from 'zod';
import { Json, Json5, LooseArray, LooseRecord, UtcDate } from './schema-utils';

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

    it('supports key schema', () => {
      const s = LooseRecord(
        z
          .string()
          .refine((x) => x === 'bar')
          .transform((x) => x.toUpperCase()),
        z.string().transform((x) => x.toUpperCase())
      );
      expect(s.parse({ foo: 'foo', bar: 'bar' })).toEqual({ BAR: 'BAR' });
    });

    it('reports key schema errors', () => {
      let errorData: unknown = null;
      const s = LooseRecord(
        z.string().refine((x) => x === 'bar'),
        z.string(),
        {
          onError: (x) => {
            errorData = x;
          },
        }
      );

      s.parse({ foo: 'foo', bar: 'bar' });

      expect(errorData).toMatchObject({
        error: {
          issues: [
            {
              code: 'custom',
              message: 'Invalid input',
              path: ['foo'],
            },
          ],
        },
        input: { bar: 'bar', foo: 'foo' },
      });
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

  describe('UtcDate', () => {
    it('parses date', () => {
      expect(UtcDate.parse('2020-04-04').toString()).toBe(
        '2020-04-04T00:00:00.000Z'
      );
    });

    it('rejects invalid date', () => {
      expect(() => UtcDate.parse('foobar')).toThrow();
    });
  });
});
