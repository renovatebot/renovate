import { GitOperationSpanProcessor } from './span-processor';

describe('util/git/span-processor', () => {
  it('creates an instance', () => {
    const processor = new GitOperationSpanProcessor();
    expect(processor).toBeInstanceOf(GitOperationSpanProcessor);
  });
});
