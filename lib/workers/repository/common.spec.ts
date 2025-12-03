import { DEBUG, ERROR, FATAL, INFO, TRACE, WARN } from 'bunyan';
import { emojiFromLevel } from './common';

describe('workers/repository/common', () => {
  describe('emojiFromLevel()', () => {
    it('handles valid levels', () => {
      expect(emojiFromLevel(TRACE)).toEqual('🔬');
      expect(emojiFromLevel(DEBUG)).toEqual('🔍');
      expect(emojiFromLevel(INFO)).toEqual('ℹ️');
      expect(emojiFromLevel(WARN)).toEqual('⚠️');
      expect(emojiFromLevel(ERROR)).toEqual('❌');
      expect(emojiFromLevel(FATAL)).toEqual('💀');
    });

    it('handles unknown level', () => {
      expect(emojiFromLevel(-1)).toEqual('');
    });
  });
});
