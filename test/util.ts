import crypto from 'crypto';
import { readFileSync } from 'fs';
import { expect } from '@jest/globals';
import upath from 'upath';
import { getConfig } from '../lib/config/defaults';
import type { RenovateConfig as _RenovateConfig } from '../lib/config/types';
import * as _logger from '../lib/logger';
import { platform as _platform } from '../lib/platform';
import * as _env from '../lib/util/exec/env';
import * as _fs from '../lib/util/fs';
import * as _git from '../lib/util/git';
import * as _hostRules from '../lib/util/host-rules';

/**
 * Simple wrapper for getting mocked version of a module
 * @param module module which is mocked by `jest.mock`
 */
export function mocked<T>(module: T): jest.Mocked<T> {
  return module as never;
}

/**
 * Simply wrapper to create partial mocks.
 * @param obj Object to cast to final type
 */
export function partial<T>(obj: Partial<T>): T {
  return obj as T;
}

export const fs = mocked(_fs);
export const git = mocked(_git);
export const platform = mocked(_platform);
export const env = mocked(_env);
export const hostRules = mocked(_hostRules);
export const logger = mocked(_logger);

// Required because of isolatedModules
export type RenovateConfig = _RenovateConfig;

export const defaultConfig = getConfig();

export { getConfig };

function getCallerFileName(): string | null {
  let result = null;

  const prepareStackTrace = Error.prepareStackTrace;
  const stackTraceLimit = Error.stackTraceLimit;

  Error.prepareStackTrace = (_err, stack) => stack;
  Error.stackTraceLimit = 5; // max calls inside this file + 1

  try {
    const err = new Error();

    const stack = err.stack as unknown as NodeJS.CallSite[];

    let currentFile = null;
    for (const frame of stack) {
      const fileName = frame.getFileName();
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

export function getName(): string {
  const file = getCallerFileName();
  const [, name] = /lib\/(.*?)\.spec\.ts$/.exec(file.replace(/\\/g, '/'));
  return name;
}

export function getFixturePath(fixtureFile: string, fixtureRoot = '.'): string {
  const callerDir = upath.dirname(getCallerFileName());
  return upath.join(callerDir, fixtureRoot, '__fixtures__', fixtureFile);
}

export function loadFixture(fixtureFile: string, fixtureRoot = '.'): string {
  const fixtureAbsFile = getFixturePath(fixtureFile, fixtureRoot);
  return readFileSync(fixtureAbsFile, { encoding: 'utf8' });
}

export function loadJsonFixture<T = any>(
  fixtureFile: string,
  fixtureRoot = '.'
): T {
  const rawFixture = loadFixture(fixtureFile, fixtureRoot);
  return JSON.parse(rawFixture) as T;
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
  replacement: string
): jest.SnapshotSerializerPlugin => ({
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

const bufferSerializer: jest.SnapshotSerializerPlugin = {
  test: (value) => Buffer.isBuffer(value),
  serialize: (val, config, indent, depth, refs, printer) => {
    const replaced = toHash(val);
    return printer(replaced, config, indent, depth, refs);
  },
};

export function addBufferSerializer(): void {
  expect.addSnapshotSerializer(bufferSerializer);
}
