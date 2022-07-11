import { regEx } from '../../util/regex';
import { getManagers, hashMap } from '.';

describe('modules/manager/fingerprint', () => {
  it('validate manager hash', () => {
    const regex = regEx(/^[a-f0-9]{64}$/i);
    const managers = getManagers();
    for (const [manager] of managers) {
      const managerHash = hashMap.get(manager)!;
      expect(regex.test(managerHash)).toBeTrue();
    }
  });
});
