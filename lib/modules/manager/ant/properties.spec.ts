import { parsePropertiesFile } from './properties.ts';
import type { AntProp } from './types.ts';

describe('modules/manager/ant/properties', () => {
  describe('parsePropertiesFile', () => {
    it('parses key=value pairs', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile(
        'key1=value1\nkey2=value2\n',
        'test.properties',
        props,
      );

      expect(props.key1).toEqual(
        expect.objectContaining({
          val: 'value1',
          packageFile: 'test.properties',
        }),
      );
      expect(props.key2).toEqual(
        expect.objectContaining({
          val: 'value2',
          packageFile: 'test.properties',
        }),
      );
    });

    it('skips comments and blank lines', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile(
        '# comment\n\nkey=value\n! another comment\n',
        'test.properties',
        props,
      );

      expect(Object.keys(props)).toEqual(['key']);
    });

    it('supports colon separator', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile('key:value\n', 'test.properties', props);

      expect(props.key).toEqual(expect.objectContaining({ val: 'value' }));
    });

    it('skips malformed lines without separators', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile(
        'key=value\nmalformed_line_no_separator\nother=val\n',
        'test.properties',
        props,
      );

      expect(Object.keys(props)).toEqual(['key', 'other']);
    });

    it('implements first-definition-wins', () => {
      const props: Record<string, AntProp> = {};
      parsePropertiesFile('key=first\nkey=second\n', 'test.properties', props);

      expect(props.key.val).toBe('first');
    });

    it('respects pre-existing props (first-definition-wins across sources)', () => {
      const props: Record<string, AntProp> = {
        key: {
          val: 'existing',
          fileReplacePosition: 0,
          packageFile: 'build.xml',
        },
      };
      parsePropertiesFile('key=new\n', 'test.properties', props);

      expect(props.key.val).toBe('existing');
      expect(props.key.packageFile).toBe('build.xml');
    });
  });
});
