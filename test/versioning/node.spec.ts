import { api as nodever } from '../../lib/versioning/node';

describe('semver.getNewValue()', () => {
  it('returns normalized toVersion', () => {
    expect(
      nodever.getNewValue({
        currentValue: '1.0.0',
        rangeStrategy: 'replace',
        fromVersion: '1.0.0',
        toVersion: 'v1.1.0',
      })
    ).toEqual('1.1.0');
  });
  it('returns range', () => {
    expect(
      nodever.getNewValue({
        currentValue: '~8.0.0',
        rangeStrategy: 'replace',
        fromVersion: '8.0.2',
        toVersion: 'v8.2.0',
      })
    ).toEqual('~8.2.0');
  });
});
