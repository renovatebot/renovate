import { DotnetVersionDatasource } from '../../../datasource/dotnet-version/index.ts';
import { dotnetVersionActions } from './dotnet-version.ts';

describe('modules/manager/github-actions/known-actions/dotnet-version', () => {
  it('uses the dotnet-version datasource for every entry', () => {
    for (const cfg of Object.values(dotnetVersionActions)) {
      expect(cfg.datasource).toBe(DotnetVersionDatasource.id);
    }
  });
});
