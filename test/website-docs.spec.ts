import fs from 'fs';
import { getOptions } from '../lib/config/definitions';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    type ContainsOption<T> = T extends ArrayLike<unknown> ? T[number] : unknown;
    interface Matchers<R, T> {
      /**
       * only available in `test/website-docs.spec.js`
       * @param arg Value which current values should contain
       */
      toContainOption(arg: ContainsOption<T>): void;
    }
  }
}

const options = getOptions();

describe('docs', () => {
  const doc = fs.readFileSync('docs/usage/configuration-options.md', 'utf8');
  const selfHostDoc = fs.readFileSync(
    'docs/usage/self-hosted-configuration.md',
    'utf8'
  );
  const headers = doc
    .match(/\n## (.*?)\n/g)
    .map((match) => match.substring(4, match.length - 1));
  const selfHostHeaders = selfHostDoc
    .match(/\n## (.*?)\n/g)
    .map((match) => match.substring(4, match.length - 1));
  const expectedOptions = options
    .filter((option) => option.stage !== 'global')
    .filter((option) => option.releaseStatus !== 'unpublished')
    .filter((option) => !option.admin)
    .filter((option) => !option.parent)
    .filter((option) => !option.autogenerated)
    .map((option) => option.name)
    .sort();

  const selfHostExpectedOptions = options
    .filter((option) => option.admin || option.stage === 'global')
    .map((option) => option.name)
    .sort();

  it('has doc headers sorted alphabetically', () => {
    expect(headers).toEqual([...headers].sort());
  });
  it('has headers for every required option', () => {
    expect(headers).toEqual(expectedOptions);
  });
  it('has self hosted doc headers sorted alphabetically', () => {
    expect(selfHostHeaders).toEqual([...selfHostHeaders].sort());
  });
  it('has headers (self hosted) for every required option', () => {
    expect(selfHostHeaders).toEqual(selfHostExpectedOptions);
  });
  const headers3 = doc
    .match(/\n### (.*?)\n/g)
    .map((match) => match.substring(5, match.length - 1));
  headers3.sort();
  const expectedOptions3 = options
    .filter((option) => option.stage !== 'global')
    .filter((option) => !option.admin)
    .filter((option) => option.parent)
    .map((option) => option.name)
    .sort();
  expectedOptions3.sort();
  it('has headers for every required sub-option', () => {
    expect(headers3).toEqual(expectedOptions3);
  });

  // Checking relatedOptions field in definitions
  const relatedOptionsMatrix = options
    .filter((option) => option.relatedOptions)
    .map((option) => option.relatedOptions)
    .sort();

  let relatedOptions: string[] = [].concat(...relatedOptionsMatrix); // Converts the matrix to an 1D array
  relatedOptions = [...new Set(relatedOptions)]; // Makes all options unique

  /*
    Matcher which checks if the argument is within the received array (or string)
    on an error, it throws a custom message.
  */
  expect.extend({
    toContainOption<T extends string>(received: T[], argument: T) {
      if (received.includes(argument)) {
        return {
          message: (): string =>
            `Option "${argument}" should be within definitions`,
          pass: true,
        };
      }
      return {
        message: (): string =>
          `Option "${argument}" doesn't exist within definitions`,
        pass: false,
      };
    },
  });

  const allOptionNames = options.map((option) => option.name).sort();

  // Lists through each option in the relatedOptions array to be able to locate the exact element which causes error, in case of one
  it('has valid relateOptions values', () => {
    relatedOptions.forEach((relOption) => {
      expect(allOptionNames).toContainOption(relOption);
    });
  });
});
