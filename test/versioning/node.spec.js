const nodever = require('../../lib/versioning/node');

describe('semver.getNewValue()', () => {
  it('returns normalized toVersion', () => {
    expect(nodever.getNewValue('1.0.0', 'replace', '1.0.0', 'v1.1.0')).toEqual(
      '1.1.0'
    );
  });
  it('returns range', () => {
    expect(nodever.getNewValue('~8.0.0', 'replace', '8.0.2', 'v8.2.0')).toEqual(
      '~8.2.0'
    );
  });
});
