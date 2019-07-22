import { getRangeStrategy } from '../../lib/manager';
import { ManagerConfig } from '../../lib/manager/common';

describe('getRangeStrategy', () => {
  it('returns same if not auto', () => {
    const config: ManagerConfig = { manager: 'npm', rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('returns manager strategy', () => {
    const config: ManagerConfig = {
      manager: 'npm',
      rangeStrategy: 'auto',
      depType: 'dependencies',
      packageJsonType: 'app',
    };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('defaults to replace', () => {
    const config: ManagerConfig = {
      manager: 'circleci',
      rangeStrategy: 'auto',
    };
    expect(getRangeStrategy(config)).toEqual('replace');
  });
  it('returns rangeStrategy if not auto', () => {
    const config: ManagerConfig = {
      manager: 'circleci',
      rangeStrategy: 'future',
    };
    expect(getRangeStrategy(config)).toEqual('future');
  });
});
