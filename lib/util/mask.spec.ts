import { testName } from '../../test/util';
import { maskToken } from './mask';

describe(testName(), () => {
  describe('.maskToken', () => {
    it('returns value if passed value is falsy', () => {
      expect(maskToken('')).toEqual('');
    });

    it('hides value content', () => {
      expect(maskToken('123456789')).toEqual('12*****89');
    });
  });
});
