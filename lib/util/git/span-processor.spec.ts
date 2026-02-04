import { GitOperationSpanProcessor } from './span-processor.ts';
import { partial } from '~test/util.ts';

describe('util/git/span-processor', () => {
  it('creates an instance', async () => {
    const processor = new GitOperationSpanProcessor();
    expect(processor).toBeInstanceOf(GitOperationSpanProcessor);
    await expect(processor.forceFlush()).resolves.toBeUndefined();
    expect(processor.onStart(partial(), partial())).toBeUndefined();
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});
