import { updateArtifacts } from '../../../lib/manager/bundler/artifacts';

let config;

describe('bundler.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    config = {};
  });
  it('returns null by default', async () => {
    expect(await updateArtifacts('', [], '', config)).toBeNull();
  });
});
