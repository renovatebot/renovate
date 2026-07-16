import type { NpmrcSettingLine } from './npmrc-parser.ts';
import { parseNpmrc, renderNpmrc } from './npmrc-parser.ts';

function parseSetting(line: string): NpmrcSettingLine {
  const [parsedLine] = parseNpmrc(line).lines;

  if (parsedLine?.type !== 'setting') {
    throw new Error(`Expected a setting line: ${line}`);
  }

  return parsedLine;
}

describe('modules/manager/npm/npmrc-parser', () => {
  describe('parseNpmrc', () => {
    describe('setting lines', () => {
      it.each`
        line         | key    | value
        ${'a=b'}     | ${'a'} | ${'b'}
        ${' a = b '} | ${'a'} | ${'b'}
        ${'a=b=c'}   | ${'a'} | ${'b=c'}
        ${'a'}       | ${'a'} | ${true}
        ${'a='}      | ${'a'} | ${''}
      `('parses $line', ({ line, key, value }) => {
        expect(parseNpmrc(line).lines).toEqual([
          {
            type: 'setting',
            section: null,
            npmSection: null,
            key,
            isArray: false,
            value,
            environmentVariableReferences: [],
            raw: line,
            lineEnding: '',
          },
        ]);
      });

      it('captures the line ending', () => {
        expect(parseNpmrc('key=value\r\n').lines).toEqual([
          {
            type: 'setting',
            section: null,
            npmSection: null,
            key: 'key',
            isArray: false,
            value: 'value',
            environmentVariableReferences: [],
            raw: 'key=value',
            lineEnding: '\r\n',
          },
        ]);
      });

      describe('value decoding', () => {
        it.each`
          line                       | value
          ${'key=value # comment'}   | ${'value'}
          ${'key=value ; comment'}   | ${'value'}
          ${'key=value \\# literal'} | ${'value # literal'}
          ${'key=value \\; literal'} | ${'value ; literal'}
        `('handles comments in $line', ({ line, value }) => {
          expect(parseSetting(line).value).toBe(value);
        });

        it.each`
          line                        | value
          ${'key=value \\\\ literal'} | ${'value \\ literal'}
          ${'key=value \\q'}          | ${'value \\q'}
          ${'key=value \\'}           | ${'value \\'}
        `('handles escapes in $line', ({ line, value }) => {
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
        `('preserves malformed quote in $line', ({ line, value }) => {
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
        `('decodes the key in $line', ({ line, key }) => {
          expect(parseSetting(line).key).toBe(key);
        });

        it.each`
          line                    | key        | isArray
          ${'key[]=value'}        | ${'key'}   | ${true}
          ${'"key[]"=value'}      | ${'key'}   | ${true}
          ${'key[] # note=value'} | ${'key'}   | ${true}
          ${'key[][]=value'}      | ${'key[]'} | ${true}
          ${'key=value'}          | ${'key'}   | ${false}
          ${'[]=value'}           | ${'[]'}    | ${false}
        `('parses bracketed array key in $line', ({ line, key, isArray }) => {
          expect(parseSetting(line)).toMatchObject({ key, isArray });
        });

        it('accepts a whitespace-only key', () => {
          expect(parseSetting('  =value')).toMatchObject({
            key: '',
            value: 'value',
          });
        });

        it.each`
          line
          ${'[section'}
          ${'[section] trailing'}
          ${'[[section]]'}
        `('treats malformed section $line as a setting', ({ line }) => {
          expect(parseSetting(line)).toMatchObject({
            key: line,
            value: true,
          });
        });
      });

      describe('environment variable references', () => {
        it.each`
          line                       | name            | optional
          ${'auth=${TOKEN}'}         | ${'TOKEN'}      | ${false}
          ${'auth="${TOKEN}"'}       | ${'TOKEN'}      | ${false}
          ${"auth='prefix${TOKEN}'"} | ${'TOKEN'}      | ${false}
          ${'auth=${TOKEN?}'}        | ${'TOKEN'}      | ${true}
          ${'auth=$${TOKEN}'}        | ${'TOKEN'}      | ${false}
          ${'auth="${TOKEN NAME}"'}  | ${'TOKEN NAME'} | ${false}
        `(
          'finds an environment variable reference in $line',
          ({ line, name, optional }) => {
            expect(parseSetting(line).environmentVariableReferences).toEqual([
              { name, optional, source: 'value' },
            ]);
          },
        );

        it('finds environment variable references in both the key and value', () => {
          expect(
            parseSetting('${SCOPE}:registry=${REGISTRY?}')
              .environmentVariableReferences,
          ).toEqual([
            {
              name: 'SCOPE',
              optional: false,
              source: 'key',
            },
            {
              name: 'REGISTRY',
              optional: true,
              source: 'value',
            },
          ]);
        });

        it('finds multiple environment variable references in a value', () => {
          expect(
            parseSetting('auth=${FIRST}-${SECOND?}')
              .environmentVariableReferences,
          ).toEqual([
            {
              name: 'FIRST',
              optional: false,
              source: 'value',
            },
            {
              name: 'SECOND',
              optional: true,
              source: 'value',
            },
          ]);
        });

        it.each`
          line
          ${'auth=value \\# ${TOKEN}'}
          ${'auth=value \\; ${TOKEN}'}
        `('parses an expression after escaped comment in $line', ({ line }) => {
          expect(parseSetting(line).environmentVariableReferences).toEqual([
            {
              name: 'TOKEN',
              optional: false,
              source: 'value',
            },
          ]);
        });

        describe('escaping', () => {
          it.each`
            rawEscapeCount | detected
            ${1}           | ${false}
            ${2}           | ${false}
            ${3}           | ${true}
            ${4}           | ${true}
            ${5}           | ${false}
            ${6}           | ${false}
          `(
            'handles $rawEscapeCount unquoted escapes',
            ({ rawEscapeCount, detected }) => {
              const escapes = '\\'.repeat(rawEscapeCount);
              const line = `auth=${escapes}${'${TOKEN}'}`;

              expect(
                parseSetting(line).environmentVariableReferences.length > 0,
              ).toBe(detected);
            },
          );

          it.each`
            decodedEscapeCount | detected
            ${1}               | ${false}
            ${2}               | ${true}
          `(
            'handles $decodedEscapeCount quoted escapes',
            ({ decodedEscapeCount, detected }) => {
              const value = `${'\\'.repeat(decodedEscapeCount)}${'${TOKEN}'}`;
              const line = `auth=${JSON.stringify(value)}`;

              expect(
                parseSetting(line).environmentVariableReferences.length > 0,
              ).toBe(detected);
            },
          );
        });

        it.each`
          line
          ${'auth=${}'}
          ${'auth=${TOKEN??}'}
          ${'auth=${TOKEN'}
          ${'auth=${TO$KEN}'}
          ${'auth=${TO{KEN}'}
        `('ignores malformed expression in $line', ({ line }) => {
          expect(parseSetting(line).environmentVariableReferences).toEqual([]);
        });

        it('continues parsing after a malformed expression', () => {
          expect(
            parseSetting('auth=${BAD${GOOD}}').environmentVariableReferences,
          ).toEqual([
            {
              name: 'GOOD',
              optional: false,
              source: 'value',
            },
          ]);
        });

        it.each`
          line
          ${'auth=value # ${TOKEN}'}
          ${'auth=value ; ${TOKEN}'}
          ${'enabled=true'}
        `('ignores inactive expression in $line', ({ line }) => {
          expect(parseSetting(line).environmentVariableReferences).toEqual([]);
        });
      });
    });

    describe('section lines', () => {
      it.each`
        line                     | name                 | npmSection
        ${'[section]'}           | ${'section'}         | ${'section'}
        ${' [section] '}         | ${'section'}         | ${null}
        ${'\uFEFF[section]'}     | ${'section'}         | ${null}
        ${'[section=value]'}     | ${'section=value'}   | ${'section=value'}
        ${'[]'}                  | ${''}                | ${''}
        ${'["quoted section"]'}  | ${'quoted section'}  | ${'quoted section'}
        ${'[section # comment]'} | ${'section'}         | ${'section'}
        ${'[section\\#literal]'} | ${'section#literal'} | ${'section#literal'}
      `('parses $line', ({ line, name, npmSection }) => {
        expect(parseNpmrc(line).lines).toEqual([
          {
            type: 'section',
            name,
            npmSection,
            environmentVariableReferences: [],
            raw: line,
            lineEnding: '',
          },
        ]);
      });

      it('finds environment variable references in a section name', () => {
        expect(parseNpmrc('[${SCOPE?}]').lines).toEqual([
          {
            type: 'section',
            name: '${SCOPE?}',
            npmSection: '${SCOPE?}',
            environmentVariableReferences: [
              {
                name: 'SCOPE',
                optional: true,
                source: 'section',
              },
            ],
            raw: '[${SCOPE?}]',
            lineEnding: '',
          },
        ]);
      });

      it('tracks section context across physical lines', () => {
        const document = parseNpmrc(
          '[first]\r\none=1\r\n# comment\r\ntwo=2\r\n[second]\r\nlast=3',
        );
        const settings = document.lines.filter(
          (line): line is NpmrcSettingLine => line.type === 'setting',
        );

        expect(
          settings.map(({ key, section, npmSection }) => ({
            key,
            section,
            npmSection,
          })),
        ).toEqual([
          {
            key: 'one',
            section: 'first',
            npmSection: 'first',
          },
          {
            key: 'two',
            section: 'first',
            npmSection: 'first',
          },
          {
            key: 'last',
            section: 'second',
            npmSection: 'second',
          },
        ]);
      });

      it('tracks permissive and npm section contexts independently', () => {
        const document = parseNpmrc(
          ' [parser-only]\ntop-level=${TOKEN}\n[recognized]\n [parser-only]\nnested=${TOKEN}',
        );
        const settings = document.lines.filter(
          (line): line is NpmrcSettingLine => line.type === 'setting',
        );

        expect(
          settings.map(({ key, section, npmSection }) => ({
            key,
            section,
            npmSection,
          })),
        ).toEqual([
          {
            key: 'top-level',
            section: 'parser-only',
            npmSection: null,
          },
          {
            key: 'nested',
            section: 'parser-only',
            npmSection: 'recognized',
          },
        ]);
      });
    });

    describe('other lines', () => {
      it.each`
        line
        ${' \t'}
        ${'  # key=value'}
        ${'\t; key=value'}
        ${'\uFEFF# key=value'}
        ${'=value'}
      `('parses $line', ({ line }) => {
        expect(parseNpmrc(line).lines).toEqual([
          {
            type: 'other',
            raw: line,
            lineEnding: '',
          },
        ]);
      });
    });

    describe('document line endings', () => {
      it.each`
        content              | detected  | trailing
        ${'key=value'}       | ${null}   | ${''}
        ${'key=value\n'}     | ${'\n'}   | ${'\n'}
        ${'key=value\r\n'}   | ${'\r\n'} | ${'\r\n'}
        ${'key=value\r'}     | ${'\r'}   | ${'\r'}
        ${'first\r\nlast'}   | ${'\r\n'} | ${''}
        ${'first\nlast\r\n'} | ${'\n'}   | ${'\r\n'}
      `(
        'records line endings in $content',
        ({ content, detected, trailing }) => {
          expect(parseNpmrc(content)).toMatchObject({
            detectedLineEnding: detected,
            trailingLineEnding: trailing,
          });
        },
      );

      it('captures every supported line ending', () => {
        const { lines } = parseNpmrc('first=1\r\nsecond=2\rlast=3\n');

        expect(
          lines.map(({ raw, lineEnding }) => ({ raw, lineEnding })),
        ).toEqual([
          { raw: 'first=1', lineEnding: '\r\n' },
          { raw: 'second=2', lineEnding: '\r' },
          { raw: 'last=3', lineEnding: '\n' },
        ]);
      });
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
    it.each`
      content
      ${''}
      ${'\n'}
      ${'\r\n'}
      ${'\r'}
      ${'key=value'}
      ${'key=value\n'}
      ${'key=value\r\n'}
      ${'key=value\r'}
      ${'\uFEFF# comment\r\n key = value \n[section]\runknown'}
      ${'\n\r\r\nkey=value\r\n\r'}
    `('losslessly renders $content', ({ content }) => {
      expect(renderNpmrc(parseNpmrc(content).lines)).toBe(content);
    });
  });
});
