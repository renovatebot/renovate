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

export const setContext = jest.fn();
export const getContext = jest.fn();
export const setMeta = jest.fn();
export const addMeta = jest.fn();
export const removeMeta = jest.fn();
export const levels = jest.fn();
export const addStream = jest.fn();
export const getProblems = jest.fn((): any[] => []);

export { logger };
