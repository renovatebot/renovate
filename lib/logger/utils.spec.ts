import { sanitizeValue, validateLogLevel } from './utils';

describe('logger/utils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('checks for valid log levels', () => {
    expect(validateLogLevel(undefined)).toBeUndefined();
    expect(validateLogLevel('warn')).toBeUndefined();
    expect(validateLogLevel('debug')).toBeUndefined();
    expect(validateLogLevel('trace')).toBeUndefined();
    expect(validateLogLevel('info')).toBeUndefined();
  });

  it.each`
    input
    ${'warning'}
    ${'100'}
    ${''}
    ${' '}
  `('checks for invalid log level: $input', (input) => {
    // Mock when the function exits
    const mockExit = jest.spyOn(process, 'exit');
    mockExit.mockImplementationOnce((number) => {
      throw new Error(`process.exit: ${number}`);
    });
    expect(() => {
      validateLogLevel(input);
    }).toThrow();
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it.each`
    input                                                                 | output
    ${' https://somepw@domain.com/gitlab/org/repo?go-get'}                | ${' https://**redacted**@domain.com/gitlab/org/repo?go-get'}
    ${'https://someuser:somepw@domain.com'}                               | ${'https://**redacted**@domain.com'}
    ${'https://someuser:@domain.com'}                                     | ${'https://**redacted**@domain.com'}
    ${'redis://:somepw@172.32.11.71:6379/0'}                              | ${'redis://**redacted**@172.32.11.71:6379/0'}
    ${'some text with\r\n url: https://somepw@domain.com\nand some more'} | ${'some text with\r\n url: https://**redacted**@domain.com\nand some more'}
    ${'[git://domain.com](git://pw@domain.com)'}                          | ${'[git://domain.com](git://**redacted**@domain.com)'}
    ${'user@domain.com'}                                                  | ${'user@domain.com'}
  `('sanitizeValue("$input") == "$output"', ({ input, output }) => {
    expect(sanitizeValue(input)).toBe(output);
  });
});
