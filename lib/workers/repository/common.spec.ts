import { DEBUG, ERROR, FATAL, INFO, TRACE, WARN } from 'bunyan';
import { formatProblemLevel } from './common';

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
});
