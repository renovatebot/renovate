import { codeBlock } from 'common-tags';
import { updateDependency } from '.';

describe('modules/manager/copier/update', () => {
  describe('updateDependency', () => {
    it('should append a new marking line at the end to trigger the artifact update', () => {
      const fileContent = codeBlock`
        _src_path: https://foo.bar/baz/quux
        _commit: 1.0.0
      `;
      const ret = updateDependency({ fileContent, upgrade: {} });
      expect(ret).toBe(`${fileContent}\n#copier updated`);
    });

    it('should not update again if the new line has been appended', () => {
      const fileContent = codeBlock`
        _src_path: https://foo.bar/baz/quux
        _commit: 1.0.0
        #copier updated
      `;
      const ret = updateDependency({ fileContent, upgrade: {} });
      expect(ret).toBe(fileContent);
    });
  });
});
