const cargo = require('../../../lib/manager/cargo/artifacts');

let config;

describe('cargo.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    config = {};
  });
  it('returns null by default', async () => {
    expect(await cargo.getArtifacts('cargo.toml', [], '', config)).toBeNull();
  });
  it('catches errors', async () => {
    expect(await cargo.getArtifacts()).toMatchSnapshot();
  });
});
