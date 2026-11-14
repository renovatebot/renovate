import { GithubReleaseAttachmentsDatasource } from '../../../datasource/github-release-attachments/index.ts';
import { githubReleaseAttachmentsDynamicActions } from './github-release-attachments-dynamic.ts';

describe('modules/manager/github-actions/known-actions/github-release-attachments-dynamic', () => {
  it('uses the github-release-attachments datasource for every entry', () => {
    for (const cfg of Object.values(githubReleaseAttachmentsDynamicActions)) {
      expect(cfg.datasource).toBe(GithubReleaseAttachmentsDatasource.id);
    }
  });
});
