import bunyan from 'bunyan';
import { validateLogLevel } from './utils';

describe('logger/utils', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('checks for valid log levels', () => {
    const lel = validateLogLevel(undefined);
    console.log(lel);
    expect(validateLogLevel(undefined)).toBeUndefined();
    expect(validateLogLevel('')).toBeUndefined();
    expect(validateLogLevel(' ')).toBeUndefined();
    expect(validateLogLevel('warn')).toBeUndefined();
    expect(validateLogLevel('debug')).toBeUndefined();
    expect(validateLogLevel('trace')).toBeUndefined();
    expect(validateLogLevel('info' as bunyan.LogLevel)).toBeUndefined();
    expect(validateLogLevel(10)).toBeUndefined();
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
