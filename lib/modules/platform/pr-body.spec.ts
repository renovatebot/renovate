import hasha from 'hasha';
import { getPrBodyStruct, hashBody, updateRenovateBody } from './pr-body';

describe('modules/platform/pr-body', () => {
  describe('getPrBodyStruct', () => {
    it('returns hash for empty inputs', () => {
      expect(getPrBodyStruct(null)).toEqual({
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
      expect(getPrBodyStruct(undefined)).toEqual({
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
      expect(getPrBodyStruct('')).toEqual({
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
      expect(
        getPrBodyStruct('<!--renovate:start--> <!--renovate:end-->')
      ).toEqual({
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
      expect(
        getPrBodyStruct(
          'something \n<!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiAiMS4yLjEiLCJ1cGRhdGVkSW5WZXIiOiAiMS4yLjMifQ==-->'
        )
      ).toEqual({
        hash: '3fc9b689459d738f8c88a3a48aa9e33542016b7a4052e001aaa536fca74813cb',
        debugData: {
          createdInVer: '1.2.1',
          updatedInVer: '1.2.3',
        },
      });
    });

    it('returns hash for inputs', () => {
      const hash = getPrBodyStruct('This is a RenovateBot PR body');
      expect(hash).toEqual({
        hash: '9830b9a9015a773d61f71187d580e368c8773b025ed408cadef32cb82680acde',
      });
      expect(
        getPrBodyStruct(
          '<!--renovate:start-->\n\nThis is a RenovateBot PR body\n\n <!--renovate:end-->\n\n'
        )
      ).toEqual(hash);
      expect(
        getPrBodyStruct(
          '<!--renovate:start-->\n\n    This is a RenovateBot PR body\n\n<!--renovate:end-->'
        )
      ).toEqual(hash);
      expect(
        getPrBodyStruct(
          '<!--renovate:start-->\n\n    This is a RenovateBot PR body\n\n'
        )
      ).toEqual(hash);
      expect(
        getPrBodyStruct('This is a RenovateBot PR body<!--renovate:end-->')
      ).toEqual(hash);
    });

    it('checks if we reach warning', () => {
      expect(
        getPrBodyStruct(
          'something \n<!--renovate-debug:some-wrong-data-ABCDEFGHIJKLMNOP-->'
        )
      ).toEqual({
        hash: '3fc9b689459d738f8c88a3a48aa9e33542016b7a4052e001aaa536fca74813cb',
      });
    });

    it('hashes ignoring debug info', () => {
      expect(hashBody('foo\n<!--renovate-debug:123-->\n')).toEqual(
        hashBody('foo')
      );
    });

    it('hashes ignoring reviewable section', () => {
      expect(hashBody('foo<!-- Reviewable:start -->bar')).toEqual(
        hashBody('foo')
      );
    });

    it('hashes an undefined body', () => {
      // nullish operator branch coverage
      const hash =
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(hashBody(undefined)).toBe(hash);
    });

    it('returns rebaseRequested=true flag', () => {
      const input = '- [x] <!-- rebase-check -->';
      const hash = hashBody(input);
      expect(getPrBodyStruct(input)).toEqual({
        hash,
        rebaseRequested: true,
      });
    });

    it('returns rebaseRequested=false flag', () => {
      const input = '- [ ] <!-- rebase-check -->';
      const hash = hashBody(input);
      expect(getPrBodyStruct(input)).toEqual({
        hash,
        rebaseRequested: false,
      });
    });

    it('returns rebaseRequested=undefined flag', () => {
      const input = '-  <!-- rebase-check -->';
      const hash = hashBody(input);
      expect(getPrBodyStruct(input)).toEqual({
        hash,
      });
    });

    it('returns raw config hash', () => {
      const config = '{}';
      const rawConfigHash = hasha(config, { algorithm: 'sha256' });
      const input = `<!--renovate-config-hash:${rawConfigHash}-->`;
      const hash = hashBody(input);
      expect(getPrBodyStruct(input)).toEqual({
        hash,
        rawConfigHash,
      });
    });

    it('strips reviewable section', () => {
      expect(getPrBodyStruct('foo<!-- Reviewable:start -->bar')).toEqual({
        hash: hashBody('foo'),
      });
    });
  });

  describe('updateRenovateBody', () => {
    test.each([
      ['', ''],
      ['', null],
      [null, ''],
      ['', 'any value'],
    ])('updateRenovateBody(%p, %p) = ""', (newBody, existingBody) => {
      expect(updateRenovateBody(newBody, existingBody)).toBe('');
    });

    it('original use case', () => {
      const newBody = 'my new body';
      const existingBody = 'the existing body';
      expect(updateRenovateBody(newBody, existingBody)).toBe(newBody);
    });

    it('With Renovate Body for both', () => {
      const newBody = '<!--renovate:start-->my new body<!--renovate:end-->';
      const existingBody =
        'There is some other text <!--renovate:start-->the existing body<!--renovate:end--> with additional textes';
      const expected =
        'There is some other text <!--renovate:start-->my new body<!--renovate:end--> with additional textes';
      expect(updateRenovateBody(newBody, existingBody)).toBe(expected);
    });

    it('With Renovate Body on existing', () => {
      const newBody = 'my new body';
      const existingBody =
        'There is some other text <!--renovate:start-->the existing body<!--renovate:end--> with additional textes';
      const expected =
        'There is some other text <!--renovate:start-->my new body<!--renovate:end--> with additional textes';
      expect(updateRenovateBody(newBody, existingBody)).toBe(expected);
    });

    it('With Renovate Body on new', () => {
      const newBody = '<!--renovate:start-->my new body<!--renovate:end-->';
      const existingBody = 'the existing body';
      const expected = 'my new body';
      expect(updateRenovateBody(newBody, existingBody)).toBe(expected);
    });

    it('With Renovate Body extended', () => {
      const newBody = `
      <!--renovate:start-->
      my new body
      
      <!--renovate:end-->`;
      const existingBody = `
      There is some other text 
      <!--renovate:start-->
      
      
      the existing body
      
      <!--renovate:end-->
      
      with additional texts`;
      const expected = `
      There is some other text 
      <!--renovate:start-->
      
      
      my new body
      
      <!--renovate:end-->
      
      with additional texts`;
      expect(updateRenovateBody(newBody, existingBody)).toBe(expected);
    });
  });
});
