import fs from 'fs/promises';
import { hashMap } from './index';

describe('modules/manager/fingerprint', () => {
  it('validate manager hash', async () => {
    const managers = (
      await fs.readdir('./lib/modules/manager', { withFileTypes: true })
    )
      .filter((file) => file.isDirectory())
      .map((file) => file.name);
    for (const manager of managers) {
      expect(hashMap.get(manager)).toBeDefined();
    }
  });
});
