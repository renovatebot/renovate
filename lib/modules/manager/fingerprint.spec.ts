import { regEx } from '../../util/regex';
import { allManagersList, hashMap } from '.';

describe('modules/manager/fingerprint', () => {
  it('validate manager hash', () => {
    const regex = regEx(/^[a-f0-9]{64}$/i);
    for (const manager of allManagersList) {
      const managerHash = hashMap.get(manager)!;
      expect(regex.test(managerHash)).toBeTrue();
    }
  });
});
