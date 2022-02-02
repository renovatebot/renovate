import bunyan from 'bunyan';
import { validateLogLevel } from './utils';

describe('validate log level', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('checks for valid log levels', () => {
    const lel = validateLogLevel(undefined);
    console.log(lel);
    expect(validateLogLevel(undefined)).toBe(undefined);
    expect(validateLogLevel('')).toBe(undefined);
    expect(validateLogLevel(' ')).toBe(undefined);
    expect(validateLogLevel('warn')).toBe(undefined);
    expect(validateLogLevel('debug')).toBe(undefined);
    expect(validateLogLevel('trace')).toBe(undefined);
    expect(validateLogLevel('info' as bunyan.LogLevel)).toBe(undefined);
    expect(validateLogLevel(10)).toBe(undefined);
  });

  it('checks for invalid log levels', () => {
    // Mock when the function exits
    const mockExit = jest.spyOn(process, 'exit');
    mockExit.mockImplementationOnce((number) => {
      throw new Error(`process.exit: ${number}`);
    });
    expect(() => {
      validateLogLevel('warning');
    }).toThrow();
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockClear();

    mockExit.mockImplementationOnce((number) => {
      throw new Error(`process.exit: ${number}`);
    });
    expect(() => {
      validateLogLevel('100');
    }).toThrow();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
