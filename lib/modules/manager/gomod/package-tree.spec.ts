import { codeBlock } from 'common-tags';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getDependentGoModFiles } from './package-tree';
import { scm } from '~test/util';

vi.mock('fs-extra');
vi.mock('../../../util/fs');

const fs = vi.hoisted(() => ({
  readLocalFile: vi.fn(),
}));

vi.mock('../../../util/fs', () => fs);

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('/tmp/repo'),
};

const sampleGoMod = codeBlock`
  module github.com/renovate-tests/gomod1

  go 1.19

  require github.com/pkg/errors v0.7.0
  require github.com/aws/aws-sdk-go v1.15.21
`;

const goModWithReplace = codeBlock`
  module github.com/renovate-tests/gomod-with-replace

  go 1.19

  require github.com/pkg/errors v0.7.0
  require github.com/renovate-tests/gomod1 v1.0.0

  replace github.com/renovate-tests/gomod1 => ../gomod1
`;

const goModWithCircularA = codeBlock`
  module github.com/renovate-tests/circular-a

  go 1.19

  require github.com/renovate-tests/circular-b v1.0.0

  replace github.com/renovate-tests/circular-b => ../circular-b
`;

const goModWithCircularB = codeBlock`
  module github.com/renovate-tests/circular-b

  go 1.19

  require github.com/renovate-tests/circular-a v1.0.0

  replace github.com/renovate-tests/circular-a => ../circular-a
`;

describe('modules/manager/gomod/package-tree', () => {
  describe('getDependentGoModFiles()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
      vi.clearAllMocks();
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('returns self for single project', async () => {
      scm.getFileList.mockResolvedValue(['go.mod']);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);

      expect(await getDependentGoModFiles('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('handles dependency relationships with tree-like and linear references', async () => {
      const goModMultiple = codeBlock`
        module github.com/renovate-tests/gomod-multiple

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0
        require github.com/renovate-tests/gomod2 v1.0.0

        replace github.com/renovate-tests/gomod1 => ../gomod1
        replace github.com/renovate-tests/gomod2 => ../gomod2
      `;

      const goModTreeLike = codeBlock`
        module github.com/renovate-tests/tree-like

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0

        replace github.com/renovate-tests/gomod1 => ../gomod1
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'gomod-with-replace/go.mod',
        'gomod-multiple/go.mod',
        'tree-like/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithReplace);
      fs.readLocalFile.mockResolvedValueOnce(goModMultiple);
      fs.readLocalFile.mockResolvedValueOnce(goModTreeLike);

      // Test linear dependency chain: gomod1 -> multiple dependents
      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'gomod-with-replace/go.mod' },
        { isLeaf: true, name: 'gomod-multiple/go.mod' },
        { isLeaf: true, name: 'tree-like/go.mod' },
      ]);

      // Test tree-like reference: leaf nodes
      expect(await getDependentGoModFiles('tree-like/go.mod')).toEqual([
        { isLeaf: true, name: 'tree-like/go.mod' },
      ]);
    });

    it('returns empty array on circular reference', async () => {
      scm.getFileList.mockResolvedValue([
        'circular-a/go.mod',
        'circular-b/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(goModWithCircularA);
      fs.readLocalFile.mockResolvedValueOnce(goModWithCircularB);

      expect(await getDependentGoModFiles('circular-a/go.mod')).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        'Circular reference detected in Go modules replace directives',
      );
    });

    it('handles invalid file content gracefully', async () => {
      scm.getFileList.mockResolvedValue(['go.mod']);

      // Test null content
      fs.readLocalFile.mockResolvedValueOnce(null);
      expect(await getDependentGoModFiles('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);

      // Test empty content
      fs.readLocalFile.mockResolvedValueOnce('');
      expect(await getDependentGoModFiles('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);

      // Test invalid syntax
      fs.readLocalFile.mockResolvedValueOnce('invalid go.mod content');
      expect(await getDependentGoModFiles('go.mod')).toEqual([
        { isLeaf: true, name: 'go.mod' },
      ]);
    });

    it('handles replace directives with version specifiers and comments', async () => {
      const goModWithVersionReplace = codeBlock`
        module github.com/renovate-tests/version-replace

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0

        replace github.com/renovate-tests/gomod1 => ../gomod1 v1.2.3 // local development
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'version-replace/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithVersionReplace);

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'version-replace/go.mod' },
      ]);
    });

    it('ignores remote replace directives', async () => {
      const goModWithRemoteReplace = codeBlock`
        module github.com/renovate-tests/remote-replace

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0

        replace github.com/renovate-tests/gomod1 => github.com/fork/gomod1 v1.0.0
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'remote-replace/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithRemoteReplace);

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: true, name: 'gomod1/go.mod' },
      ]);
    });

    it('handles multiline replace blocks', async () => {
      const goModWithMultilineReplace = codeBlock`
        module github.com/renovate-tests/multiline-replace

        go 1.19

        require github.com/renovate-tests/gomod1 v1.0.0
        require github.com/renovate-tests/gomod2 v1.0.0

        replace (
          github.com/renovate-tests/gomod1 => ../gomod1
          github.com/renovate-tests/gomod2 => ../gomod2
        )
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'multiline-replace/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithMultilineReplace);

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: true, name: 'multiline-replace/go.mod' },
      ]);
    });

    it('handles complex dependency chains', async () => {
      const goModLevel2 = codeBlock`
        module github.com/renovate-tests/level2

        go 1.19

        require github.com/renovate-tests/gomod-with-replace v1.0.0

        replace github.com/renovate-tests/gomod-with-replace => ../gomod-with-replace
      `;

      scm.getFileList.mockResolvedValue([
        'gomod1/go.mod',
        'gomod-with-replace/go.mod',
        'level2/go.mod',
      ]);
      fs.readLocalFile.mockResolvedValueOnce(sampleGoMod);
      fs.readLocalFile.mockResolvedValueOnce(goModWithReplace);
      fs.readLocalFile.mockResolvedValueOnce(goModLevel2);

      expect(await getDependentGoModFiles('gomod1/go.mod')).toEqual([
        { isLeaf: false, name: 'gomod1/go.mod' },
        { isLeaf: false, name: 'gomod-with-replace/go.mod' },
        { isLeaf: true, name: 'level2/go.mod' },
      ]);

      expect(await getDependentGoModFiles('gomod-with-replace/go.mod')).toEqual(
        [{ isLeaf: true, name: 'gomod-with-replace/go.mod' }],
      );
    });
  });
});
