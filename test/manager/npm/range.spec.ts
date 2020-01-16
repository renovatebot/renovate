import { getRangeStrategy } from '../../../lib/manager/npm';
import { RangeConfig } from '../../../lib/manager/common';
import {
  DEP_TYPE_DEPENDENCIES,
  DEP_TYPE_DEV_DEPENDENCIES,
  DEP_TYPE_PEER_DEPENDENCIES,
} from '../../../lib/constants/dependency';

describe('getRangeStrategy', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('pins devDependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_DEV_DEPENDENCIES,
    };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('pins app dependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_DEPENDENCIES,
      packageJsonType: 'app',
    };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('widens peerDependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_PEER_DEPENDENCIES,
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('widens complex ranges', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_DEPENDENCIES,
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('widens complex bump', () => {
    const config: RangeConfig = {
      rangeStrategy: 'bump',
      depType: DEP_TYPE_DEPENDENCIES,
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('defaults to replace', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_DEPENDENCIES,
    };
    expect(getRangeStrategy(config)).toEqual('replace');
  });
});
