import { matchRegexOrGlobList } from '../../../util/string-match.ts';
import { CdnjsDatasource } from '../../datasource/cdnjs/index.ts';
import { UnpkgDatasource } from '../../datasource/unpkg/index.ts';
import { defaultConfig, supportedDatasources } from './index.ts';

describe('modules/manager/html/index', () => {
  describe('managerFilePatterns', () => {
    it.each`
      path              | expected
      ${'index.html'}   | ${true}
      ${'index.htm'}    | ${true}
      ${'index.xhtml'}  | ${false}
      ${'package.json'} | ${false}
    `('matches $path: $expected', ({ path, expected }) => {
      expect(
        matchRegexOrGlobList(path, defaultConfig.managerFilePatterns),
      ).toBe(expected);
    });
  });

  describe('supportedDatasources', () => {
    it.each([CdnjsDatasource.id, UnpkgDatasource.id])(
      'contains %s',
      (datasource) => {
        expect(supportedDatasources).toContain(datasource);
      },
    );
  });
});
