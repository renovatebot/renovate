import { getName } from '../../../test/util';
import { check } from './managers';

describe(getName(__filename), () => {
  it('should have no errors', () => {
    const res = check({ resolvedRule: { managers: ['npm'] }, currentPath: '' });
    expect(res).toEqual([]);
  });
});
