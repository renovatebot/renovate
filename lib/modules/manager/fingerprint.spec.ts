import { getManagers, hashMap } from './index';

describe('modules/manager/fingerprint', () => {
  it('validate manager hash', () => {
    const managers = getManagers();
    for (const [manager] of managers) {
      expect(hashMap.get(manager)).toBeDefined();
    }
  });
});
