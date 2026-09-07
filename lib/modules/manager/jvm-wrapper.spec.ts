import type { Stats } from 'node:fs';
import os from 'node:os';
import { fs, partial } from '~test/util.ts';
import { GlobalConfig } from '../../config/global.ts';
import type { StatusResult } from '../../util/git/types.ts';
import {
  collectModifiedFiles,
  javaToolConstraint,
  prepareWrapperCommand,
  wrapperFileName,
} from './jvm-wrapper.ts';

const platform = vi.spyOn(os, 'platform');
vi.mock('../../util/fs/index.ts');

describe('modules/manager/jvm-wrapper', () => {
  describe('wrapperFileName()', () => {
    it('returns the windows name on windows', () => {
      platform.mockReturnValueOnce('win32');
      expect(wrapperFileName('./mvnw', 'mvnw.cmd')).toBe('mvnw.cmd');
    });

    it('returns the posix name inside docker', () => {
      platform.mockReturnValueOnce('win32');
      GlobalConfig.set({ binarySource: 'docker' });
      expect(wrapperFileName('./mvnw', 'mvnw.cmd')).toBe('./mvnw');
    });

    it('returns the posix name on linux', () => {
      platform.mockReturnValueOnce('linux');
      expect(wrapperFileName('./mvnw', 'mvnw.cmd')).toBe('./mvnw');
    });
  });

  describe('prepareWrapperCommand()', () => {
    it('returns null if the wrapper is not a file', async () => {
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({ isFile: () => false }),
      );
      await expect(
        prepareWrapperCommand('./gradlew', './gradlew'),
      ).resolves.toBeNull();
      expect(fs.chmodLocalFile).not.toHaveBeenCalled();
    });

    it('keeps the mode of an executable wrapper', async () => {
      platform.mockReturnValue('linux');
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({ isFile: () => true, mode: 0o555 }),
      );
      await expect(
        prepareWrapperCommand('./gradlew', './gradlew'),
      ).resolves.toBe('./gradlew');
      expect(fs.chmodLocalFile).not.toHaveBeenCalled();
    });

    it('adds the executable bit and appends args', async () => {
      platform.mockReturnValue('linux');
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({ isFile: () => true, mode: 0o550 }),
      );
      await expect(
        prepareWrapperCommand('sub/./mvnw', './mvnw', 'wrapper:wrapper'),
      ).resolves.toBe('./mvnw wrapper:wrapper');
      expect(fs.chmodLocalFile).toHaveBeenCalledWith('sub/./mvnw', 0o551);
    });

    it('never changes the mode on windows', async () => {
      platform.mockReturnValue('win32');
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({ isFile: () => true, mode: 0o550 }),
      );
      await expect(prepareWrapperCommand('mvnw.cmd', 'mvnw.cmd')).resolves.toBe(
        'mvnw.cmd',
      );
      expect(fs.chmodLocalFile).not.toHaveBeenCalled();
    });
  });

  describe('javaToolConstraint()', () => {
    it('prefers the configured constraint', () => {
      expect(
        javaToolConstraint({ constraints: { java: '^21.0.0' } }, '^17.0.0'),
      ).toEqual({ toolName: 'java', constraint: '^21.0.0' });
    });

    it('falls back to the given constraint', () => {
      expect(javaToolConstraint({}, '^17.0.0')).toEqual({
        toolName: 'java',
        constraint: '^17.0.0',
      });
    });

    it('passes through a missing constraint', () => {
      expect(javaToolConstraint({}, null)).toEqual({
        toolName: 'java',
        constraint: null,
      });
    });
  });

  describe('collectModifiedFiles()', () => {
    it('returns modified files only, in the given order', async () => {
      const status = partial<StatusResult>({
        modified: ['mvnw', '.mvn/wrapper/maven-wrapper.properties'],
      });
      fs.readLocalFile.mockImplementation((file) =>
        Promise.resolve(`${file} contents` as never),
      );

      await expect(
        collectModifiedFiles(status, [
          '.mvn/wrapper/maven-wrapper.properties',
          '.mvn/wrapper/maven-wrapper.jar',
          'mvnw',
        ]),
      ).resolves.toEqual([
        {
          file: {
            type: 'addition',
            path: '.mvn/wrapper/maven-wrapper.properties',
            contents: '.mvn/wrapper/maven-wrapper.properties contents',
          },
        },
        {
          file: {
            type: 'addition',
            path: 'mvnw',
            contents: 'mvnw contents',
          },
        },
      ]);
    });

    it('returns an empty list if nothing was modified', async () => {
      const status = partial<StatusResult>({ modified: [] });
      await expect(collectModifiedFiles(status, ['mvnw'])).resolves.toEqual([]);
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });
  });
});
