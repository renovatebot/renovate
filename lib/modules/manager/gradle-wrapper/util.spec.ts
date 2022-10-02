import type { Stats } from 'fs';
import os from 'os';
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
  });

  describe('extractGradleVersion()', () => {
    it('works for undefined', () => {
      // TODO #7154
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
      platform.mockReturnValueOnce('linux');
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({
          isFile: () => true,
          mode: 0o550,
        })
      );
      expect(await prepareGradleCommand('./gradlew')).toBe('./gradlew');
    });

    it('returns null', async () => {
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({
          isFile: () => false,
        })
      );
      expect(await prepareGradleCommand('./gradlew')).toBeNull();
    });
  });
});
