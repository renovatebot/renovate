import { check } from './managers';
import { getName } from '../../../test/util';

describe(getName(__filename), () => {
  it('should have no errors', () => {
    const res = check({ resolvedRule: { managers: ['npm'] }, currentPath: '' });
    expect(res).toEqual([]);
  });
});
