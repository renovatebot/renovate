const bundler = require('../../../lib/manager/bundler/artifacts');

let config;

describe('bundler.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    config = {};
  });

  it('returns null by default', async () => {
    expect(await bundler.getArtifacts('', [], '', config)).toBeNull();
  });

  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current Gemfile.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current Gemfile.lock');
    expect(await bundler.getArtifacts('Gemfile', [], '{}', config)).toBeNull();
  });

  it('returns updated Gemfile.lock', async () => {
    platform.getFile.mockReturnValueOnce('Current Gemfile.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New Gemfile.lock');

    expect(
      await bundler.getArtifacts('Gemfile', ['rake'], '{}', config)
    ).not.toBeNull();
  });
});
