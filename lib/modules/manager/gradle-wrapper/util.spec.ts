import type { Stats } from 'node:fs';
import os from 'node:os';
import { fs, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import {
  extractGradleVersion,
  getJavaConstraint,
  gradleWrapperFileName,
  prepareGradleCommand,
} from './utils';

const platform = jest.spyOn(os, 'platform');
jest.mock('../../../util/fs');

describe('modules/manager/gradle-wrapper/util', () => {
  beforeEach(() => GlobalConfig.reset());

  describe('getJavaConstraint()', () => {
    it('return ^8.0.0 for global mode', () => {
      expect(getJavaConstraint('4')).toBe('^8.0.0');
    });

    it('return ^11.0.0 for docker mode and undefined gradle', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaConstraint('')).toBe('^11.0.0');
    });

    it('return ^8.0.0 for docker gradle < 5', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaConstraint('4.9')).toBe('^8.0.0');
    });

    it('return ^11.0.0 for docker gradle >=5 && <7', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaConstraint('6.0')).toBe('^11.0.0');
    });

    it('return ^16.0.0 for docker gradle >= 7', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaConstraint('7.0.1')).toBe('^16.0.0');
    });

    it('return ^17.0.0 for docker gradle >= 7.3', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaConstraint('7.3.0')).toBe('^17.0.0');
      expect(getJavaConstraint('8.0.1')).toBe('^17.0.0');
    });
  });

  describe('extractGradleVersion()', () => {
    it('works for undefined', () => {
      // TODO #22198
      expect(extractGradleVersion(undefined as never)).toBeNull();
    });
  });

  describe('gradleWrapperFileName()', () => {
    it('works on windows', () => {
      platform.mockReturnValueOnce('win32');
      expect(gradleWrapperFileName()).toBe('gradlew.bat');
    });

    it('works on linux', () => {
      platform.mockReturnValueOnce('linux');
      expect(gradleWrapperFileName()).toBe('./gradlew');
    });
  });

  describe('prepareGradleCommand', () => {
    it('works', async () => {
      platform.mockReturnValue('linux');
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({
          isFile: () => true,
          mode: 0o550,
        }),
      );
      expect(await prepareGradleCommand('./gradlew')).toBe('./gradlew');
    });

    it('returns null', async () => {
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({
          isFile: () => false,
        }),
      );
      expect(await prepareGradleCommand('./gradlew')).toBeNull();
    });
  });
});
