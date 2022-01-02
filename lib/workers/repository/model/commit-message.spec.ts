import { CommitMessage } from './commit-message';

describe('workers/repository/model/commit-message', () => {
  describe('CommitMessage', () => {
    it('has colon character separator', () => {
      expect(CommitMessage.SEPARATOR).toBe(':');
    });
  });
});
