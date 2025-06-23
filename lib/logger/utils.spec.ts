import { TimeoutError } from 'got';
import { z } from 'zod';
import prepareError, {
  prepareZodIssues,
  sanitizeValue,
  validateLogLevel,
} from './utils';

describe('logger/utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks for valid log levels', () => {
    expect(validateLogLevel(undefined, 'info')).toBe('info');
    expect(validateLogLevel('warn', 'info')).toBe('warn');
    expect(validateLogLevel('debug', 'info')).toBe('debug');
    expect(validateLogLevel('trace', 'info')).toBe('trace');
    expect(validateLogLevel('info', 'info')).toBe('info');
    expect(validateLogLevel('error', 'info')).toBe('error');
    expect(validateLogLevel('fatal', 'info')).toBe('fatal');
  });

  it.each`
    input
    ${'warning'}
    ${'100'}
    ${''}
    ${' '}
  `('checks for invalid log level: $input', (input) => {
    // Mock when the function exits
    const mockExit = vi.spyOn(process, 'exit');
    mockExit.mockImplementationOnce((number) => {
      // TODO: types (#22198)
      throw new Error(`process.exit: ${number}`);
    });
    expect(() => {
      validateLogLevel(input, 'info');
    }).toThrow();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it.each`
    input                                                                 | output
    ${' https://somepw@domain.com/gitlab/org/repo?go-get'}                | ${' https://**redacted**@domain.com/gitlab/org/repo?go-get'}
    ${'https://someuser:somepw@domain.com'}                               | ${'https://**redacted**@domain.com'}
    ${'https://someuser:pass%word_with-speci(a)l&chars@domain.com'}       | ${'https://**redacted**@domain.com'}
    ${'https://someuser:@domain.com'}                                     | ${'https://**redacted**@domain.com'}
    ${'redis://:somepw@172.32.11.71:6379/0'}                              | ${'redis://**redacted**@172.32.11.71:6379/0'}
    ${'some text with\r\n url: https://somepw@domain.com\nand some more'} | ${'some text with\r\n url: https://**redacted**@domain.com\nand some more'}
    ${'[git://domain.com](git://pw@domain.com)'}                          | ${'[git://domain.com](git://**redacted**@domain.com)'}
    ${'data:text/vnd-example;foo=bar;base64,R0lGODdh'}                    | ${'data:text/vnd-example;**redacted**'}
    ${'user@domain.com'}                                                  | ${'user@domain.com'}
  `('sanitizeValue("$input") == "$output"', ({ input, output }) => {
    expect(sanitizeValue(input)).toBe(output);
  });

  it('preserves secret template strings in redacted fields', () => {
    const input = {
      normal: 'value',
      token: '{{ secrets.MY_SECRET }}',
      password: '{{secrets.ANOTHER_SECRET}}',
      content: '{{ secrets.CONTENT_SECRET }}',
      npmToken: '{{ secrets.NPM_TOKEN }}',
      forkToken: 'some-token',
      nested: {
        authorization: '{{ secrets.NESTED_SECRET }}',
        password: 'some-password',
      },
    };
    const expected = {
      normal: 'value',
      token: '{{ secrets.MY_SECRET }}',
      password: '{{secrets.ANOTHER_SECRET}}',
      content: '[content]',
      npmToken: '{{ secrets.NPM_TOKEN }}',
      forkToken: '***********',
      nested: {
        authorization: '{{ secrets.NESTED_SECRET }}',
        password: '***********',
      },
    };
    expect(sanitizeValue(input)).toEqual(expected);
  });

  describe('prepareError', () => {
    function getError<T extends z.ZodType>(
      schema: T,
      input: unknown,
    ): z.ZodError | null {
      try {
        schema.parse(input);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return error;
        }
      }
      throw new Error('Expected error');
    }

    function prepareIssues<T extends z.ZodType>(
      schema: T,
      input: unknown,
    ): unknown {
      const error = getError(schema, input);
      return error ? prepareZodIssues(error.format()) : null;
    }

    it('prepareZodIssues', () => {
      expect(prepareZodIssues(null)).toBe(null);
      expect(prepareZodIssues({ _errors: ['a', 'b'] })).toEqual(['a', 'b']);

      expect(prepareIssues(z.string(), 42)).toBe(
        'Expected string, received number',
      );

      expect(prepareIssues(z.string().array(), 42)).toBe(
        'Expected array, received number',
      );

      expect(
        prepareIssues(z.string().array(), ['foo', 'bar', 42, 42, 42, 42, 42]),
      ).toEqual({
        '2': 'Expected string, received number',
        '3': 'Expected string, received number',
        '4': 'Expected string, received number',
        ___: '... 2 more',
      });

      expect(
        prepareIssues(z.record(z.string()), {
          foo: 'foo',
          bar: 'bar',
          key1: 42,
          key2: 42,
          key3: 42,
          key4: 42,
          key5: 42,
        }),
      ).toEqual({
        key1: 'Expected string, received number',
        key2: 'Expected string, received number',
        key3: 'Expected string, received number',
        ___: '... 2 more',
      });

      expect(
        prepareIssues(
          z.object({
            foo: z.object({
              bar: z.string(),
            }),
          }),
          { foo: { bar: [], baz: 42 } },
        ),
      ).toEqual({
        foo: {
          bar: 'Expected string, received array',
        },
      });

      expect(
        prepareIssues(
          z.discriminatedUnion('type', [
            z.object({ type: z.literal('foo') }),
            z.object({ type: z.literal('bar') }),
          ]),
          { type: 'baz' },
        ),
      ).toEqual({
        type: "Invalid discriminator value. Expected 'foo' | 'bar'",
      });

      expect(
        prepareIssues(
          z.discriminatedUnion('type', [
            z.object({ type: z.literal('foo') }),
            z.object({ type: z.literal('bar') }),
          ]),
          {},
        ),
      ).toEqual({
        type: "Invalid discriminator value. Expected 'foo' | 'bar'",
      });

      expect(
        prepareIssues(
          z.discriminatedUnion('type', [
            z.object({ type: z.literal('foo') }),
            z.object({ type: z.literal('bar') }),
          ]),
          42,
        ),
      ).toBe('Expected object, received number');
    });

    it('prepareError', () => {
      const err = getError(
        z.object({
          foo: z.object({
            bar: z.object({
              baz: z.string(),
            }),
          }),
        }),
        { foo: { bar: { baz: 42 } } },
      );

      expect(prepareError(err!)).toEqual({
        issues: {
          foo: {
            bar: {
              baz: 'Expected string, received number',
            },
          },
        },
        message: 'Schema error',
        stack: expect.stringMatching(/^ZodError: Schema error/),
      });
    });

    it('handles HTTP timout error', () => {
      const err = new TimeoutError(
        // @ts-expect-error some types are private
        new Error('timeout'),
        {},
        { context: { hostType: 'foo' } },
      );
      Object.assign(err, {
        response: {},
      });
      expect(prepareError(err)).toMatchObject({
        message: 'timeout',
        name: 'TimeoutError',
      });
    });

    it('handles AggregateError', () => {
      const err = new Error('err');
      err.stack = 'err stack';
      const aggregateErr = new AggregateError([err], 'aggregate');
      aggregateErr.stack = 'aggregate stack';
      expect(prepareError(aggregateErr)).toMatchObject({
        message: 'aggregate',
        stack: 'aggregate stack',
        errors: [
          {
            message: 'err',
            stack: 'err stack',
          },
        ],
      });
    });
  });
});
