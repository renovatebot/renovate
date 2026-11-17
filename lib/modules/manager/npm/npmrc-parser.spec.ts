import { parseNpmrc, renderNpmrc } from './npmrc-parser.ts';
import type { NpmrcSectionLine, NpmrcSettingLine } from './types.ts';

function parseSetting(line: string): NpmrcSettingLine {
  const [parsedLine] = parseNpmrc(line).lines;

  if (parsedLine?.type !== 'setting') {
    throw new Error(`Expected a setting line: ${line}`);
  }

  return parsedLine;
}

function parseSection(line: string): NpmrcSectionLine {
  const [parsedLine] = parseNpmrc(line).lines;

  if (parsedLine?.type !== 'section') {
    throw new Error(`Expected a section line: ${line}`);
  }

  return parsedLine;
}

describe('modules/manager/npm/npmrc-parser', () => {
  describe('parseNpmrc', () => {
    it.each`
      line           | key        | value    | isArray
      ${'a=b'}       | ${'a'}     | ${'b'}   | ${false}
      ${' a = b '}   | ${'a'}     | ${'b'}   | ${false}
      ${'a=b=c'}     | ${'a'}     | ${'b=c'} | ${false}
      ${'a'}         | ${'a'}     | ${true}  | ${false}
      ${'a='}        | ${'a'}     | ${''}    | ${false}
      ${'key[]=v'}   | ${'key'}   | ${'v'}   | ${true}
      ${'key[][]=v'} | ${'key[]'} | ${'v'}   | ${true}
      ${'[]=v'}      | ${'[]'}    | ${'v'}   | ${false}
      ${'  =v'}      | ${''}      | ${'v'}   | ${false}
    `('parses $line', ({ line, key, value, isArray }) => {
      expect(parseSetting(line)).toEqual({
        type: 'setting',
        section: null,
        key,
        isArray,
        value,
        raw: line,
        lineEnding: '',
      });
    });

    describe('value decoding', () => {
      it.each`
        line                        | value
        ${'key=value # comment'}    | ${'value'}
        ${'key=value ; comment'}    | ${'value'}
        ${'key=value \\# literal'}  | ${'value # literal'}
        ${'key=value \\; literal'}  | ${'value ; literal'}
        ${'key=value \\\\ literal'} | ${'value \\ literal'}
        ${'key=value \\q'}          | ${'value \\q'}
        ${'key=value \\'}           | ${'value \\'}
      `('handles comments and escapes in $line', ({ line, value }) => {
        expect(parseSetting(line).value).toBe(value);
      });

      it.each`
        line                      | value
        ${'key="quoted # value"'} | ${'quoted # value'}
        ${"key='quoted ; value'"} | ${'quoted ; value'}
        ${'key="true"'}           | ${true}
        ${"key='true'"}           | ${true}
        ${'key=\'"nested"\''}     | ${'nested'}
      `('handles quotes in $line', ({ line, value }) => {
        expect(parseSetting(line).value).toBe(value);
      });

      it.each`
        line                   | value
        ${'key="invalid\\x"'}  | ${'"invalid\\x"'}
        ${'key="unterminated'} | ${'"unterminated'}
      `('preserves malformed quotes in $line', ({ line, value }) => {
        expect(parseSetting(line).value).toBe(value);
      });

      it.each`
        line           | value
        ${'key=true'}  | ${true}
        ${'key=false'} | ${false}
        ${'key=null'}  | ${null}
      `('parses primitive value in $line', ({ line, value }) => {
        expect(parseSetting(line).value).toBe(value);
      });
    });

    describe('key decoding', () => {
      it.each`
        line                                     | key
        ${'"package-lock"=false'}                | ${'package-lock'}
        ${"'package-lock'=false"}                | ${'package-lock'}
        ${'package-lock # note=false'}           | ${'package-lock'}
        ${'package-lock ; note=false'}           | ${'package-lock'}
        ${'//registry.test/:_authToken = token'} | ${'//registry.test/:_authToken'}
        ${'\uFEFFkey=value'}                     | ${'key'}
        ${'"key[]"=value'}                       | ${'key'}
        ${'key[] # note=value'}                  | ${'key'}
      `('decodes the key in $line', ({ line, key }) => {
        expect(parseSetting(line).key).toBe(key);
      });

      it.each`
        line
        ${'[section'}
        ${'[section] trailing'}
        ${'[[section]]'}
        ${' [section]'}
        ${'\uFEFF[section]'}
      `('treats non-section $line as a setting', ({ line }) => {
        expect(parseSetting(line)).toMatchObject({
          section: null,
          key: line.trim(),
          value: true,
        });
      });
    });

    describe('sections', () => {
      it.each`
        line                     | name
        ${'[section]'}           | ${'section'}
        ${'[section=value]'}     | ${'section=value'}
        ${'[]'}                  | ${''}
        ${'["quoted section"]'}  | ${'quoted section'}
        ${'[section # comment]'} | ${'section'}
        ${'[section\\#literal]'} | ${'section#literal'}
      `('parses $line', ({ line, name }) => {
        expect(parseSection(line)).toEqual({
          type: 'section',
          name,
          raw: line,
          lineEnding: '',
        });
      });

      it('tracks section context across physical lines', () => {
        const settings = parseNpmrc(
          '[first]\r\none=1\r\n# comment\r\ntwo=2\r\n[second]\r\nlast=3',
        ).lines.filter(
          (line): line is NpmrcSettingLine => line.type === 'setting',
        );

        expect(settings.map(({ key, section }) => ({ key, section }))).toEqual([
          { key: 'one', section: 'first' },
          { key: 'two', section: 'first' },
          { key: 'last', section: 'second' },
        ]);
      });

      it('does not change context for an indented section-like key', () => {
        const settings = parseNpmrc(
          ' [top-level]\none=1\n[recognized]\n [nested]\ntwo=2',
        ).lines.filter(
          (line): line is NpmrcSettingLine => line.type === 'setting',
        );

        expect(settings.map(({ key, section }) => ({ key, section }))).toEqual([
          { key: '[top-level]', section: null },
          { key: 'one', section: null },
          { key: '[nested]', section: 'recognized' },
          { key: 'two', section: 'recognized' },
        ]);
      });
    });

    it.each`
      line
      ${' \t'}
      ${'  # key=value'}
      ${'\t; key=value'}
      ${'\uFEFF# key=value'}
      ${'=value'}
      ${"['true']"}
      ${"'true'=value"}
    `('classifies $line as other', ({ line }) => {
      expect(parseNpmrc(line).lines).toEqual([
        { type: 'other', raw: line, lineEnding: '' },
      ]);
    });

    it.each`
      content              | detected  | trailing
      ${'key=value'}       | ${null}   | ${''}
      ${'key=value\n'}     | ${'\n'}   | ${'\n'}
      ${'key=value\r\n'}   | ${'\r\n'} | ${'\r\n'}
      ${'key=value\r'}     | ${'\r'}   | ${'\r'}
      ${'first\r\nlast'}   | ${'\r\n'} | ${''}
      ${'first\nlast\r\n'} | ${'\n'}   | ${'\r\n'}
    `('records line endings in $content', ({ content, detected, trailing }) => {
      expect(parseNpmrc(content)).toMatchObject({
        detectedLineEnding: detected,
        trailingLineEnding: trailing,
      });
    });

    it('captures mixed physical line endings', () => {
      const { lines } = parseNpmrc('first=1\r\nsecond=2\rlast=3\n');

      expect(lines.map(({ raw, lineEnding }) => ({ raw, lineEnding }))).toEqual(
        [
          { raw: 'first=1', lineEnding: '\r\n' },
          { raw: 'second=2', lineEnding: '\r' },
          { raw: 'last=3', lineEnding: '\n' },
        ],
      );
    });

    it('parses an empty document', () => {
      expect(parseNpmrc('')).toEqual({
        lines: [],
        detectedLineEnding: null,
        trailingLineEnding: '',
      });
    });
  });

  describe('renderNpmrc', () => {
    it.each([
      '',
      '\n',
      '\r\n',
      '\r',
      'key=value',
      'key=value\n',
      'key=value\r\n',
      'key=value\r',
      '\uFEFF# comment\r\n key = value \n[section]\runknown',
      '\n\r\r\nkey=value\r\n\r',
    ])('losslessly renders %j', (content) => {
      expect(renderNpmrc(parseNpmrc(content).lines)).toBe(content);
    });
  });
});
