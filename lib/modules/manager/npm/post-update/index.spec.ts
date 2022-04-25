// TODO: add tests
import { fs, git } from '../../../../../test/util';
import type { FileChange } from '../../../../util/git/types';
import { updateYarnBinary } from './';

jest.mock('../../../../util/fs');
jest.mock('../../../../util/git');

describe('modules/manager/npm/post-update/index', () => {
  const lockFileDir = `path/to/lockfile`;
  const oldYarnrcYml = `yarnPath: .yarn/releases/yarn-3.0.1.cjs\na: b\n`;
  const newYarnrcYml = `yarnPath: .yarn/releases/yarn-3.0.2.cjs\nc: d\n`;
  const newYarn = `new yarn\n`;

  beforeEach(() => {
    git.getFile = jest.fn();
    fs.readLocalFile = jest.fn();
  });

  describe('updateYarnBinary()', () => {
    it('should update the Yarn binary', async () => {
      git.getFile.mockResolvedValueOnce(oldYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarn);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toMatchSnapshot();
    });

    it('should return .yarnrc.yml content if it has been overwritten', async () => {
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(newYarn);
      const updatedArtifacts: FileChange[] = [];
      const existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        oldYarnrcYml
      );
      expect(git.getFile).not.toHaveBeenCalled();
      expect(existingYarnrcYmlContent).toMatchSnapshot();
      expect(updatedArtifacts).toMatchSnapshot();
    });

    it("should not update the Yarn binary if the old .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(null);
      fs.readLocalFile.mockResolvedValueOnce(newYarnrcYml);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should not update the Yarn binary if the new .yarnrc.yml doesn't exist", async () => {
      git.getFile.mockResolvedValueOnce(oldYarnrcYml);
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      const updatedArtifacts: FileChange[] = [];
      const yarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        undefined
      );
      expect(yarnrcYmlContent).toBeUndefined();
      expect(updatedArtifacts).toBeEmpty();
    });

    it("should return existing .yarnrc.yml if the new one doesn't exist", async () => {
      fs.readLocalFile.mockResolvedValueOnce(null as never);
      const updatedArtifacts: FileChange[] = [];
      const existingYarnrcYmlContent = await updateYarnBinary(
        lockFileDir,
        updatedArtifacts,
        oldYarnrcYml
      );
      expect(existingYarnrcYmlContent).toMatch(oldYarnrcYml);
      expect(updatedArtifacts).toBeEmpty();
    });
  });
});
