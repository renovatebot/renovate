import { getRangeStrategy } from '../../../lib/manager/npm';
import { RangeConfig } from '../../../lib/manager/common';
import {
  DEP_TYPE_DEPENDENCY,
  DEP_TYPE_DEV,
  DEP_TYPE_PEER,
} from '../../../lib/constants/dependency';

describe('getRangeStrategy', () => {
  it('returns same if not auto', () => {
    const config: RangeConfig = { rangeStrategy: 'widen' };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('pins devDependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_DEV,
    };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('pins app dependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_DEPENDENCY,
      packageJsonType: 'app',
    };
    expect(getRangeStrategy(config)).toEqual('pin');
  });
  it('widens peerDependencies', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_PEER,
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('widens complex ranges', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_DEPENDENCY,
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('widens complex bump', () => {
    const config: RangeConfig = {
      rangeStrategy: 'bump',
      depType: DEP_TYPE_DEPENDENCY,
      currentValue: '^1.6.0 || ^2.0.0',
    };
    expect(getRangeStrategy(config)).toEqual('widen');
  });
  it('defaults to replace', () => {
    const config: RangeConfig = {
      rangeStrategy: 'auto',
      depType: DEP_TYPE_DEPENDENCY,
    };
    expect(getRangeStrategy(config)).toEqual('replace');
  });
});
