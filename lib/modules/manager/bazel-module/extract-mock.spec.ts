import { mocked } from '../../../../test/util';
import { extractPackageFile } from './extract';
import { RecordFragment, ValueFragment } from './fragments';
import * as _parser from './parser';

jest.mock('./parser');
const parser = mocked(_parser);

describe('modules/manager/bazel-module/extract-mock', () => {
  describe('extractPackageFile', () => {
    it('gracefully handles unexpected fragments', () => {
      const fragments: ValueFragment[] = [new RecordFragment()];
      parser.parse.mockReturnValueOnce(fragments);
      expect(extractPackageFile('', 'MODULE.bazel')).toBeNull();
    });
  });
});
