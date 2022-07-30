import { updateDependency } from '.';

describe('modules/manager/hermit/update', () => {
  describe('updateDependency', () => {
    it('should append a new marking line at the end to trigger the artifact update', () => {
      const fileContent = `#!/bin/bash
#some hermit content
`;
      const ret = updateDependency({ fileContent, upgrade: {} });
      expect(ret).toBe(`${fileContent}\n#hermit updated`);
    });

    it('should not update again if the new line has been appended', () => {
      const fileContent = `#!/bin/bash
#some hermit content
#hermit updated`;
      const ret = updateDependency({ fileContent, upgrade: {} });
      expect(ret).toBe(`${fileContent}`);
    });
  });
});
