import { CommitMessageFactory } from './commit-message-factory.ts';

describe('workers/repository/model/commit-message-factory', () => {
  it('creates a custom commit message without a prefix', () => {
    const message = new CommitMessageFactory({}).create();
    message.subject = 'add renovate.json';

    expect(message.toString()).toBe('Add renovate.json');
  });
});
