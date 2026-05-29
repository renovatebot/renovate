import { DEBUG, ERROR, FATAL, INFO, TRACE, WARN } from 'bunyan';
import { formatProblemLevel, replacementAlreadyExists } from './common.ts';

describe('workers/repository/common', () => {
  describe('formatProblemLevel()', () => {
    it('handles trace level', () => {
      expect(formatProblemLevel(TRACE)).toEqual('🔬 TRACE');
    });

    it('handles debug level', () => {
      expect(formatProblemLevel(DEBUG)).toEqual('🔍 DEBUG');
    });

    it('handles info level', () => {
      expect(formatProblemLevel(INFO)).toEqual('ℹ️ INFO');
    });

    it('handles warn level', () => {
      expect(formatProblemLevel(WARN)).toEqual('⚠️ WARN');
    });

    it('handles error level', () => {
      expect(formatProblemLevel(ERROR)).toEqual('❌ ERROR');
    });

    it('handles fatal level', () => {
      expect(formatProblemLevel(FATAL)).toEqual('💀 FATAL');
    });
  });

  describe('replacementAlreadyExists()', () => {
    it('returns true when replacement target exists as sibling depName', () => {
      const dep = { depName: 'old-pkg' };
      const update = {
        updateType: 'replacement' as const,
        newName: 'new-pkg',
        newValue: '2.0.0',
      };
      const siblings = [dep, { depName: 'new-pkg' }];
      expect(replacementAlreadyExists(update, dep, siblings)).toBeTrue();
    });

    it('returns true when replacement target exists as sibling packageName', () => {
      const dep = { depName: 'old-pkg' };
      const update = {
        updateType: 'replacement' as const,
        newName: 'new-pkg',
        newValue: '2.0.0',
      };
      const siblings = [dep, { depName: 'alias', packageName: 'new-pkg' }];
      expect(replacementAlreadyExists(update, dep, siblings)).toBeTrue();
    });

    it('returns false when replacement target does not exist', () => {
      const dep = { depName: 'old-pkg' };
      const update = {
        updateType: 'replacement' as const,
        newName: 'new-pkg',
        newValue: '2.0.0',
      };
      const siblings = [dep, { depName: 'other-pkg' }];
      expect(replacementAlreadyExists(update, dep, siblings)).toBeFalse();
    });

    it('returns false for non-replacement updates', () => {
      const dep = { depName: 'old-pkg' };
      const update = {
        updateType: 'minor' as const,
        newName: 'new-pkg',
        newValue: '2.0.0',
      };
      const siblings = [dep, { depName: 'new-pkg' }];
      expect(replacementAlreadyExists(update, dep, siblings)).toBeFalse();
    });

    it('returns false when newName is not set', () => {
      const dep = { depName: 'old-pkg' };
      const update = {
        updateType: 'replacement' as const,
        newValue: '2.0.0',
      };
      const siblings = [dep, { depName: 'new-pkg' }];
      expect(replacementAlreadyExists(update, dep, siblings)).toBeFalse();
    });
  });
});
