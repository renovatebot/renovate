import { postExtract } from './index.ts';
import { getLockedVersions } from './locked-versions.ts';
import { detectMonorepos } from './monorepo.ts';
import { addTransitiveDeps } from './transitive.ts';

vi.mock('./locked-versions.ts');
vi.mock('./monorepo.ts');
vi.mock('./transitive.ts');

describe('modules/manager/npm/extract/post/index', () => {
  it('extracts transitive dependencies only when vulnerability alerts are enabled', async () => {
    await postExtract([]);
    expect(detectMonorepos).toHaveBeenCalledOnce();
    expect(getLockedVersions).toHaveBeenCalledOnce();
    expect(addTransitiveDeps).not.toHaveBeenCalled();

    await postExtract([], true);
    expect(addTransitiveDeps).toHaveBeenCalledExactlyOnceWith([]);
  });
});
