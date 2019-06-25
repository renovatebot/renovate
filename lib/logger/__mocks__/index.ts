const loggerLevels: string[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'child',
];
const logger: any = {};

loggerLevels.forEach(k => {
  logger[k] = jest.fn();
});

export const setMeta = jest.fn();
export const levels = jest.fn();

export { logger };
