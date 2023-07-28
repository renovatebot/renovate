import { regEx } from '../../util/regex';
import { getManagerList, hashMap } from '.';
import { getCustomManagerList } from './custom';

describe('modules/manager/fingerprint', () => {
  it('validate manager hash', () => {
    const regex = regEx(/^[a-f0-9]{64}$/i);
    const allManagers = [
      ...getManagerList(),
      ...getCustomManagerList().map((m) => `custom.${m}`),
    ];
    for (const manager of allManagers) {
      const managerHash = hashMap.get(manager)!;
      expect(regex.test(managerHash)).toBeTrue();
    }
  });
});
