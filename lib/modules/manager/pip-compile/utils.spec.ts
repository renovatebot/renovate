import { inferCommandExecDir } from './utils';

describe('modules/manager/pip-compile/utils', () => {
  describe('inferCommandExecDir()', () => {
    it.each([
      {
        fileName: 'subdir/reqs.txt',
        outputFile: 'subdir/reqs.txt',
        result: '.',
      },
      {
        fileName: 'subdir/reqs.txt',
        outputFile: 'reqs.txt',
        result: 'subdir',
      },
    ])(
      'returns object on correct options',
      ({ fileName, outputFile, result }) => {
        expect(inferCommandExecDir(fileName, outputFile)).toEqual(result);
      },
    );
  });
});
