const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/homebrew/update');

const aide = fs.readFileSync('test/manager/homebrew/_fixtures/aide.rb', 'utf8');
const ibazel = fs.readFileSync(
  'test/manager/homebrew/_fixtures/ibazel.rb',
  'utf8'
);

describe('manager/homebrew/update', () => {
  it('updates "releases" github dependency', () => {
    const upgrade = {
      currentValue: 'v0.16.1',
      depName: 'Aide',
      sha256:
        '0f2b7cecc70c1a27d35c06c98804fcdb9f326630de5d035afc447122186010b7',
      url:
        'https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz',
      newValue: 'v0.17.7',
    };
    const newContent = updateDependency(aide, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toMatchSnapshot();
  });
  it('updates "archive" github dependency', () => {
    const upgrade = {
      currentValue: 'v0.8.2',
      depName: 'Ibazel',
      sha256:
        '26f5125218fad2741d3caf937b02296d803900e5f153f5b1f733f15391b9f9b4',
      url: 'https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz',
      newValue: 'v0.9.3',
    };
    const newContent = updateDependency(ibazel, upgrade);
    expect(newContent).not.toBeNull();
    expect(newContent).toMatchSnapshot();
  });
});
