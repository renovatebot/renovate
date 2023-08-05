import { regEx } from '../../util/regex';
import { getCustomManagerList } from './custom';
import { getManagerList, hashMap } from '.';

describe('modules/manager/fingerprint', () => {
  it('validate manager hash', () => {
    const regex = regEx(/^[a-f0-9]{64}$/i);
    const allManagers = [...getManagerList(), ...getCustomManagerList()];
    for (const manager of allManagers) {
      const managerHash = hashMap.get(manager)!;
      expect(regex.test(managerHash)).toBeTrue();
    }
  });
});
