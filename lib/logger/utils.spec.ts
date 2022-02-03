import bunyan from 'bunyan';
import { validateLogLevel } from './utils';

describe('logger/utils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('checks for valid log levels', () => {
    expect(validateLogLevel(undefined)).toBeUndefined();
    expect(validateLogLevel('')).toBeUndefined();
    expect(validateLogLevel(' ')).toBeUndefined();
    expect(validateLogLevel('warn')).toBeUndefined();
    expect(validateLogLevel('debug')).toBeUndefined();
    expect(validateLogLevel('trace')).toBeUndefined();
    expect(validateLogLevel('info' as bunyan.LogLevel)).toBeUndefined();
    expect(validateLogLevel(10)).toBeUndefined();
  });

  it.each`
    input
    ${'warning'}
    ${'100'}
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
});
