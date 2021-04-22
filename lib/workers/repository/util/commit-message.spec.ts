import { testName } from '../../../../test/util';
import {
  COMMIT_MESSAGE_PREFIX_SEPARATOR,
  formatCommitMessagePrefix,
} from './commit-message';

describe(testName(), () => {
  describe('COMMIT_MESSAGE_PREFIX_END_CHARACTER', () => {
    it('is a colon character', () => {
      expect(COMMIT_MESSAGE_PREFIX_SEPARATOR).toBe(':');
    });
  });
  describe('formatCommitMessagePrefix', () => {
    it.each([
      [
        'adds a separator',
        'does not end',
        'RENOV-123',
        `RENOV-123${COMMIT_MESSAGE_PREFIX_SEPARATOR}`,
      ],
      [
        'does nothing',
        'ends',
        `RENOV-123${COMMIT_MESSAGE_PREFIX_SEPARATOR}`,
        `RENOV-123${COMMIT_MESSAGE_PREFIX_SEPARATOR}`,
      ],
    ])(
      '%s when the prefix %s with a separator',
      (
        expectedAction: string,
        endingState: string,
        commitMessagePrefix: string,
        expectedPrefix: string
      ) => {
        expect(formatCommitMessagePrefix(commitMessagePrefix)).toBe(
          expectedPrefix
        );
      }
    );
  });
});
