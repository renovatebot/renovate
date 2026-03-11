import { validateLogLevel } from './bunyan.ts';

vi.mock('bunyan', () => ({ createLogger: () => ({ fatal: vi.fn() }) }));

describe('logger/bunyan', () => {
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
    expect(mockExit).toHaveBeenCalledExactlyOnceWith(1);
  });
});
