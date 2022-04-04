import { regEx } from '../../util/regex';
import { getManagers, hashMap } from '.';

describe('modules/manager/fingerprint', () => {
  it('validate manager hash', () => {
    const managers = getManagers();
    for (const [manager] of managers) {
      const managerHash = hashMap.get(manager);
      expect(managerHash).toBeDefined();
      expect(regEx(/^[a-f0-9]{64}$/gi).test(managerHash)).toBe(true);
    }
  });
});
