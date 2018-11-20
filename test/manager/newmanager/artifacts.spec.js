const cargo = require('../../../lib/manager/newmanager/artifacts');

let config;

describe('newmanager.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    config = {};
  });
  it('returns null by default', async () => {
    expect(await cargo.getArtifacts('', [], '', config)).toBeNull();
  });
});
