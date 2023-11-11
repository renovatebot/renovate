import crypto from 'node:crypto';
import { expect, jest } from '@jest/globals';
import type { Plugin } from 'pretty-format';
import upath from 'upath';
import type { RenovateConfig } from '../lib/config/types';
import * as _logger from '../lib/logger';
import { Platform, platform as _platform } from '../lib/modules/platform';
import { scm as _scm } from '../lib/modules/platform/scm';
import * as _env from '../lib/util/exec/env';
import * as _fs from '../lib/util/fs';
import * as _git from '../lib/util/git';
import * as _hostRules from '../lib/util/host-rules';
import { regEx } from '../lib/util/regex';

/**
 * Simple wrapper for getting mocked version of a module
 * @param module module which is mocked by `jest.mock`
 */
export function mocked<T extends object>(module: T): jest.Mocked<T> {
  return jest.mocked(module);
}

/**
 * Simple wrapper for getting mocked version of a function
 * @param func function which is mocked by `jest.mock`
 */
export function mockedFunction<T extends (...args: any[]) => any>(
  func: T,
): jest.MockedFunction<T> {
  return func as jest.MockedFunction<T>;
}

/**
 * Simply wrapper to create partial mocks.
 * @param obj Object to cast to final type
 */
export function partial<T>(): T;
export function partial<T>(obj: Partial<T>): T;
export function partial<T>(obj: Partial<T>[]): T[];
export function partial(obj: unknown = {}): unknown {
  return obj;
}

export const fs = jest.mocked(_fs);
export const git = jest.mocked(_git);

// TODO: fix types, jest / typescript is using wrong overload (#22198)
export const platform = jest.mocked(partial<Required<Platform>>(_platform));
export const scm = jest.mocked(_scm);
export const env = jest.mocked(_env);
export const hostRules = jest.mocked(_hostRules);
export const logger = jest.mocked(_logger);

export type { RenovateConfig };

function getCallerFileName(): string | null {
  let result: string | null = null;

  const prepareStackTrace = Error.prepareStackTrace;
  const stackTraceLimit = Error.stackTraceLimit;

  Error.prepareStackTrace = (_err, stack) => stack;
  Error.stackTraceLimit = 5; // max calls inside this file + 1

  try {
    const err = new Error();

    const stack = err.stack as unknown as NodeJS.CallSite[];

    let currentFile: string | null = null;
    for (const frame of stack) {
      const fileName = frame.getFileName() ?? null;
      if (!currentFile) {
        currentFile = fileName;
      } else if (currentFile !== fileName) {
        result = fileName;
        break;
      }
    }
  } catch (e) {
    // no-op
  }

  Error.prepareStackTrace = prepareStackTrace;
  Error.stackTraceLimit = stackTraceLimit;

  return result;
}

export function getFixturePath(fixtureFile: string, fixtureRoot = '.'): string {
  const callerDir = upath.dirname(getCallerFileName()!);
  return upath.join(callerDir, fixtureRoot, '__fixtures__', fixtureFile);
}

/**
 * Can be used to search and replace strings in jest snapshots.
 * @example
 * expect.addSnapshotSerializer(
 *     replacingSerializer(upath.toUnix(gradleDir.path), 'localDir')
 * );
 */
export const replacingSerializer = (
  search: string,
  replacement: string,
): Plugin => ({
  test: (value) => typeof value === 'string' && value.includes(search),
  serialize: (val, config, indent, depth, refs, printer) => {
    const replaced = (val as string).replace(search, replacement);
    return printer(replaced, config, indent, depth, refs);
  },
});

export function addReplacingSerializer(from: string, to: string): void {
  expect.addSnapshotSerializer(replacingSerializer(from, to));
}

function toHash(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const bufferSerializer: Plugin = {
  test: (value) => Buffer.isBuffer(value),
  serialize: (val, config, indent, depth, refs, printer) => {
    const replaced = toHash(val);
    return printer(replaced, config, indent, depth, refs);
  },
};

export function addBufferSerializer(): void {
  expect.addSnapshotSerializer(bufferSerializer);
}

export function regexMatches(target: string, patterns: string[]): boolean {
  return patterns.some((patt: string) => {
    const re = regEx(patt);
    return re.test(target);
  });
}
