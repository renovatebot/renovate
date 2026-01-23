import { GitOperationSpanProcessor } from './span-processor';
import { partial } from '~test/util';

describe('util/git/span-processor', () => {
  it('creates an instance', async () => {
    const processor = new GitOperationSpanProcessor();
    expect(processor).toBeInstanceOf(GitOperationSpanProcessor);
    await expect(processor.forceFlush()).resolves.toBeUndefined();
    expect(processor.onStart(partial(), partial())).toBeUndefined();
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});
