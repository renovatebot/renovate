import is from '@sindresorhus/is';
import { Fixtures } from '../../../../test/fixtures';
import { parseDepsEdnFile } from './parser';

describe('modules/manager/deps-edn/parser', () => {
  describe('parseEdnFile', () => {
    it.each`
      input                     | output
      ${''}                     | ${undefined}
      ${':foo'}                 | ${undefined}
      ${'foo'}                  | ${undefined}
      ${'1'}                    | ${undefined}
      ${'1.5'}                  | ${undefined}
      ${'1e1'}                  | ${undefined}
      ${'1e-1'}                 | ${undefined}
      ${'[]'}                   | ${undefined}
      ${'}'}                    | ${undefined}
      ${'{}'}                   | ${{}}
      ${'{'}                    | ${{}}
      ${'{:foo :foo}'}          | ${{ foo: 'foo' }}
      ${'{:foo foo}'}           | ${{ foo: 'foo' }}
      ${'{:foo 1}'}             | ${{ foo: '1' }}
      ${'{:foo 1.5}'}           | ${{ foo: '1.5' }}
      ${'{:foo 1e1}'}           | ${{ foo: '1e1' }}
      ${'{:foo 1e-1}'}          | ${{ foo: '1e-1' }}
      ${'{:foo {}}'}            | ${{ foo: {} }}
      ${'{{} :foo}'}            | ${{}}
      ${'{{} {}}'}              | ${{}}
      ${'{:foo :bar}'}          | ${{ foo: 'bar' }}
      ${'{:foo 1 :bar 2}'}      | ${{ foo: '1', bar: '2' }}
      ${'{:foo {:bar 2} :baz}'} | ${{ foo: { bar: '2' } }}
      ${'{:foo [:bar :baz]}'}   | ${{ foo: ['bar', 'baz'] }}
      ${'{:foo {:bar :baz}}'}   | ${{ foo: { bar: 'baz' } }}
      ${'{:foo [{:bar :baz}]}'} | ${{ foo: [{ bar: 'baz' }] }}
      ${'{:foo {:bar :baz}}'}   | ${{ foo: { bar: 'baz' } }}
    `(`'$input' parses to $output`, ({ input, output }) => {
      const res = parseDepsEdnFile(input);
      expect(res?.data).toEqual(output);
    });

    it('extracts file', () => {
      const content = Fixtures.get('deps.edn');
      const res = parseDepsEdnFile(content);

      expect(res?.data).toMatchSnapshot({
        deps: { 'persistent-sorted-set': { 'mvn/version': '0.1.2' } },
      });

      const dep =
        is.plainObject(res) &&
        is.plainObject(res.data['deps']) &&
        is.plainObject(res.data['deps']['persistent-sorted-set']) &&
        res.data['deps']['persistent-sorted-set'];
      expect(dep && res?.metadata?.get(dep)).toEqual({
        replaceString: '{:mvn/version,"0.1.2"}',
      });
    });
  });
});
