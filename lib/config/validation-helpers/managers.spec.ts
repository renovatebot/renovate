import { testName } from '../../../test/util';
import { check } from './managers';

describe(testName(), () => {
  it('should have no errors', () => {
    const res = check({
      resolvedRule: { matchManagers: ['npm'] },
      currentPath: '',
    });
    expect(res).toEqual([]);
  });
});
