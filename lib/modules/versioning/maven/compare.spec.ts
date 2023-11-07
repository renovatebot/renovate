import {
  autoExtendMavenRange,
  compare,
  isSubversion,
  parseRange,
  rangeToStr,
  tokenize,
} from './compare';

describe('modules/versioning/maven/compare', () => {
  describe('Standard behavior', () => {
    // @see https://github.com/apache/maven/blob/master/maven-artifact/src/test/java/org/apache/maven/artifact/versioning/ComparableVersionTest.java
    // @see https://github.com/apache/maven/blob/master/maven-artifact/src/test/java/org/apache/maven/artifact/versioning/DefaultArtifactVersionTest.java
    describe('equality', () => {
      it.each`
        x                       | y
        ${'1'}                  | ${'1'}
        ${'1'}                  | ${'1.0'}
        ${'1'}                  | ${'1.0.0'}
        ${'1.0'}                | ${'1.0.0'}
        ${'1'}                  | ${'1-0'}
        ${'1'}                  | ${'1.0-0'}
        ${'1.0'}                | ${'1.0-0'}
        ${'1a'}                 | ${'1-a'}
        ${'1a'}                 | ${'1.0-a'}
        ${'1a'}                 | ${'1.0.0-a'}
        ${'1.0a'}               | ${'1-a'}
        ${'1.0.0a'}             | ${'1-a'}
        ${'1x'}                 | ${'1-x'}
        ${'1x'}                 | ${'1.0-x'}
        ${'1x'}                 | ${'1.0.0-x'}
        ${'1.0x'}               | ${'1-x'}
        ${'1.0.0x'}             | ${'1-x'}
        ${'1ga'}                | ${'1'}
        ${'1release'}           | ${'1'}
        ${'1final'}             | ${'1'}
        ${'1cr'}                | ${'1rc'}
        ${'1a1'}                | ${'1-alpha-1'}
        ${'1b2'}                | ${'1-beta-2'}
        ${'1m3'}                | ${'1-milestone-3'}
        ${'1X'}                 | ${'1x'}
        ${'1A'}                 | ${'1a'}
        ${'1B'}                 | ${'1b'}
        ${'1M'}                 | ${'1m'}
        ${'1Ga'}                | ${'1'}
        ${'1GA'}                | ${'1'}
        ${'1RELEASE'}           | ${'1'}
        ${'1release'}           | ${'1'}
        ${'1RELeaSE'}           | ${'1'}
        ${'1Final'}             | ${'1'}
        ${'1FinaL'}             | ${'1'}
        ${'1FINAL'}             | ${'1'}
        ${'1Cr'}                | ${'1Rc'}
        ${'1cR'}                | ${'1rC'}
        ${'1m3'}                | ${'1Milestone3'}
        ${'1m3'}                | ${'1MileStone3'}
        ${'1m3'}                | ${'1MILESTONE3'}
        ${'2.0-0'}              | ${'2.0'}
        ${'1.0.0'}              | ${'1'}
        ${'1-a1'}               | ${'1-alpha-1'}
        ${'1-b1'}               | ${'1-beta-1'}
        ${'1.0.0'}              | ${'1.ga'}
        ${'1-ga'}               | ${'1.ga'}
        ${'1.final'}            | ${'1.0'}
        ${'1'}                  | ${'1.0'}
        ${'1.'}                 | ${'1-'}
        ${'1.0.0-0.0.0'}        | ${'1-final'}
        ${'1-1.foo-bar1baz-.1'} | ${'1-1.foo-bar-1-baz-0.1'}
        ${'1.0ALPHA1'}          | ${'1.0-a1'}
        ${'1.0Alpha1'}          | ${'1.0-a1'}
        ${'1.0AlphA1'}          | ${'1.0-a1'}
        ${'1.0BETA1'}           | ${'1.0-b1'}
        ${'1.0MILESTONE1'}      | ${'1.0-m1'}
        ${'1.0RC1'}             | ${'1.0-cr1'}
        ${'1.0GA'}              | ${'1.0'}
        ${'1.0FINAL'}           | ${'1.0'}
        ${'1.0-SNAPSHOT'}       | ${'1-snapshot'}
        ${'1.0alpha1'}          | ${'1.0-a1'}
        ${'1.0alpha-1'}         | ${'1.0-a1'}
        ${'1.0beta1'}           | ${'1.0-b1'}
        ${'1.0beta-1'}          | ${'1.0-b1'}
        ${'1.0milestone1'}      | ${'1.0-m1'}
        ${'1.0milestone-1'}     | ${'1.0-m1'}
        ${'1.0rc1'}             | ${'1.0-cr1'}
        ${'1.0rc-1'}            | ${'1.0-cr1'}
        ${'1.0ga'}              | ${'1.0'}
        ${'1-0.ga'}             | ${'1.0'}
        ${'1.0-final'}          | ${'1.0'}
        ${'1-0-ga'}             | ${'1.0'}
        ${'1-0-final'}          | ${'1-0'}
        ${'1-0'}                | ${'1.0'}
        ${'0.0-1552'}           | ${'0.0-1552'}
        ${'5.0.7'}              | ${'5.0.7.RELEASE'}
        ${'Hoxton.RELEASE'}     | ${'hoxton'}
        ${'Hoxton.SR1'}         | ${'hoxton.sr-1'}
        ${'1_5ea'}              | ${'1.0_5ea'}
        ${'1.foo'}              | ${'1-foo'}
        ${'1.x'}                | ${'1-x'}
      `('$x == $y', ({ x, y }) => {
        expect(compare(x, y)).toBe(0);
        expect(compare(y, x)).toBe(0);
      });
    });

    describe('ordering', () => {
      it.each`
        x                                               | y
        ${'1'}                                          | ${'2'}
        ${'1.5'}                                        | ${'2'}
        ${'1'}                                          | ${'2.5'}
        ${'1.0'}                                        | ${'1.1'}
        ${'1.1'}                                        | ${'1.2'}
        ${'1.0.0'}                                      | ${'1.1'}
        ${'1.0.1'}                                      | ${'1.1'}
        ${'1.1'}                                        | ${'1.2.0'}
        ${'1.0-alpha-1'}                                | ${'1.0'}
        ${'1.0-alpha-1'}                                | ${'1.0-alpha-2'}
        ${'1.0-alpha-1'}                                | ${'1.0-beta-1'}
        ${'1.0-beta-1'}                                 | ${'1.0-SNAPSHOT'}
        ${'1.0-SNAPSHOT'}                               | ${'1.0'}
        ${'1.0-alpha-1-SNAPSHOT'}                       | ${'1.0-alpha-1'}
        ${'1.0'}                                        | ${'1.0-1'}
        ${'1.0-1'}                                      | ${'1.0-2'}
        ${'1.0.0'}                                      | ${'1.0-1'}
        ${'2.0-1'}                                      | ${'2.0.1'}
        ${'2.0.1-klm'}                                  | ${'2.0.1-lmn'}
        ${'2.0.1'}                                      | ${'2.0.1-xyz'}
        ${'2.0.1'}                                      | ${'2.0.1-123'}
        ${'2.0.1-xyz'}                                  | ${'2.0.1-123'}
        ${'1'}                                          | ${'2'}
        ${'1.5'}                                        | ${'2'}
        ${'1'}                                          | ${'2.5'}
        ${'1.0'}                                        | ${'1.1'}
        ${'1.1'}                                        | ${'1.2'}
        ${'1.0.0'}                                      | ${'1.1'}
        ${'1.1'}                                        | ${'1.2.0'}
        ${'1.1.2.alpha1'}                               | ${'1.1.2'}
        ${'1.1.2.alpha1'}                               | ${'1.1.2.beta1'}
        ${'1.1.2.beta1'}                                | ${'1.2'}
        ${'1.0-alpha-1'}                                | ${'1.0'}
        ${'1.0-alpha-1'}                                | ${'1.0-alpha-2'}
        ${'1.0-alpha-2'}                                | ${'1.0-alpha-15'}
        ${'1.0-alpha-1'}                                | ${'1.0-beta-1'}
        ${'1.0-beta-1'}                                 | ${'1.0-SNAPSHOT'}
        ${'1.0-SNAPSHOT'}                               | ${'1.0'}
        ${'1.0-alpha-1-SNAPSHOT'}                       | ${'1.0-alpha-1'}
        ${'1.0'}                                        | ${'1.0-1'}
        ${'1.0-1'}                                      | ${'1.0-2'}
        ${'2.0'}                                        | ${'2.0-1'}
        ${'2.0.0'}                                      | ${'2.0-1'}
        ${'2.0-1'}                                      | ${'2.0.1'}
        ${'2.0.1-klm'}                                  | ${'2.0.1-lmn'}
        ${'2.0.1'}                                      | ${'2.0.1-xyz'}
        ${'2.0.1-xyz-1'}                                | ${'2.0.1-1-xyz'}
        ${'2.0.1'}                                      | ${'2.0.1-123'}
        ${'2.0.1-xyz'}                                  | ${'2.0.1-123'}
        ${'1.2.3-10000000000'}                          | ${'1.2.3-10000000001'}
        ${'1.2.3-1'}                                    | ${'1.2.3-10000000001'}
        ${'2.3.0-v200706262000'}                        | ${'2.3.0-v200706262130'}
        ${'2.0.0.v200706041905-7C78EK9E_EkMNfNOd2d8qq'} | ${'2.0.0.v200706041906-7C78EK9E_EkMNfNOd2d8qq'}
        ${'1.0-RC1'}                                    | ${'1.0-SNAPSHOT'}
        ${'1.0-rc1'}                                    | ${'1.0-SNAPSHOT'}
        ${'1.0-rc-1'}                                   | ${'1.0-SNAPSHOT'}
        ${'1'}                                          | ${'1.1'}
        ${'1'}                                          | ${'2'}
        ${'1-snapshot'}                                 | ${'1'}
        ${'1.2.3-snap1'}                                | ${'1.2.3-snap2'}
        ${'1'}                                          | ${'1-sp'}
        ${'1-foo2'}                                     | ${'1-foo10'}
        ${'1-m1'}                                       | ${'1-milestone-2'}
        ${'1-foo'}                                      | ${'1-1'}
        ${'1-alpha.1'}                                  | ${'1-beta.1'}
        ${'1-1'}                                        | ${'1.1'}
        ${'1-ga'}                                       | ${'1-sp'}
        ${'1-ga.1'}                                     | ${'1-sp.1'}
        ${'1-sp-1'}                                     | ${'1-ga-1'}
        ${'1-cr1'}                                      | ${'1'}
        ${'0.0-1552'}                                   | ${'1.10.520'}
        ${'0.0.1'}                                      | ${'999'}
        ${'1.3-RC1-groovy-2.5'}                         | ${'1.3-groovy-2.5'}
        ${'1-milestone'}                                | ${'1-snapshot'}
        ${'1-abc'}                                      | ${'1-xyz'}
        ${'Hoxton.RELEASE'}                             | ${'Hoxton.SR1'}
        ${'2.0'}                                        | ${'2.0-PFD2'}
        ${'2.0'}                                        | ${'2.0.SP1'}
        ${'2.0-PFD2'}                                   | ${'2.0.SP1'}
        ${'1.3.9'}                                      | ${'1.3.9.fix-log4j2'}
        ${'1-0.alpha'}                                  | ${'1'}
        ${'1-0.beta'}                                   | ${'1'}
        ${'1-0.alpha'}                                  | ${'1-0.beta'}
        ${'1_5ea'}                                      | ${'1_c3b'}
        ${'1_c3b'}                                      | ${'2'}
        ${'17.0.5'}                                     | ${'17.0.5+8'}
      `('$x < $y', ({ x, y }) => {
        expect(compare(x, y)).toBe(-1);
        expect(compare(y, x)).toBe(1);
      });
    });
  });

  // @see https://issues.apache.org/jira/browse/MNG-7644
  describe('MNG-7644', () => {
    it.each`
      qualifier
      ${'abc'}
      ${'alpha'}
      ${'a'}
      ${'beta'}
      ${'b'}
      ${'def'}
      ${'milestone'}
      ${'m'}
      ${'RC'}
    `('$qualifier', ({ qualifier }: { qualifier: string }) => {
      // 1.0.0.X1 < 1.0.0-X2 for any string x
      expect(compare(`1.0.0.${qualifier}1`, `1.0.0-${qualifier}2`)).toBe(-1);

      // 2.0.X == 2-X == 2.0.0.X for any string x
      expect(compare(`2-${qualifier}`, `2.0.${qualifier}`)).toBe(0); // previously ordered, now equals
      expect(compare(`2-${qualifier}`, `2.0.0.${qualifier}`)).toBe(0); // previously ordered, now equals
      expect(compare(`2.0.${qualifier}`, `2.0.0.${qualifier}`)).toBe(0); // previously ordered, now equals
    });
  });

  describe('isSubversion', () => {
    it.each`
      majorVersion         | minorVersion    | expected
      ${'1.2.3'}           | ${'1.2.3'}      | ${true}
      ${'1.2.3'}           | ${'1.0.0'}      | ${false}
      ${'2.0.0'}           | ${'2.0.1'}      | ${true}
      ${'3.1.0'}           | ${'3.01.00'}    | ${true}
      ${'4.0.0'}           | ${''}           | ${false}
      ${'5.0.0'}           | ${'4.5.2'}      | ${false}
      ${'6.0.0'}           | ${'6.0.0-beta'} | ${true}
      ${'invalid.version'} | ${''}           | ${false}
      ${''}                | ${'1.2.3'}      | ${false}
      ${'v1.2.3'}          | ${'1.2.3'}      | ${true}
      ${'v1.2.3'}          | ${'v1.2.3'}     | ${true}
    `(
      'isSubversion("$majorVersion", "$minorVersion") === $expected',
      ({ majorVersion, minorVersion, expected }) => {
        expect(isSubversion(majorVersion, minorVersion)).toBe(expected);
      },
    );
  });

  describe('tokenize', () => {
    const zeroToken = {
      prefix: 'PREFIX_HYPHEN',
      type: 'TYPE_NUMBER',
      val: 0,
      isTransition: false,
    };
    const testObj = [
      {
        input: '1.2.3',
        expected: [
          {
            isTransition: false,
            prefix: 'PREFIX_HYPHEN',
            type: 'TYPE_NUMBER',
            val: 1,
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_NUMBER',
            val: 2,
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_NUMBER',
            val: 3,
          },
        ],
      },
      {
        input: 'alpha.beta.rc',
        expected: [
          {
            isTransition: false,
            prefix: 'PREFIX_HYPHEN',
            type: 'TYPE_QUALIFIER',
            val: 'alpha',
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_QUALIFIER',
            val: 'beta',
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_QUALIFIER',
            val: 'rc',
          },
        ],
      },
      {
        input: '1.2.3-alpha.beta',
        expected: [
          {
            isTransition: false,
            prefix: 'PREFIX_HYPHEN',
            type: 'TYPE_NUMBER',
            val: 1,
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_NUMBER',
            val: 2,
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_NUMBER',
            val: 3,
          },
          {
            isTransition: false,
            prefix: 'PREFIX_HYPHEN',
            type: 'TYPE_QUALIFIER',
            val: 'alpha',
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_QUALIFIER',
            val: 'beta',
          },
        ],
      },
      {
        input: '1.2.x-3',
        expected: [
          {
            isTransition: false,
            prefix: 'PREFIX_HYPHEN',
            type: 'TYPE_NUMBER',
            val: 1,
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_NUMBER',
            val: 2,
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_QUALIFIER',
            val: 'x',
          },
          {
            isTransition: false,
            prefix: 'PREFIX_HYPHEN',
            type: 'TYPE_NUMBER',
            val: 3,
          },
        ],
      },
      {
        input: '00.02.003',
        expected: [
          {
            isTransition: false,
            prefix: 'PREFIX_HYPHEN',
            type: 'TYPE_NUMBER',
            val: 0,
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_NUMBER',
            val: 2,
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_NUMBER',
            val: 3,
          },
        ],
      },
      {
        input: 'invalid.version',
        expected: [
          {
            isTransition: false,
            prefix: 'PREFIX_HYPHEN',
            type: 'TYPE_QUALIFIER',
            val: 'invalid',
          },
          {
            isTransition: false,
            prefix: 'PREFIX_DOT',
            type: 'TYPE_QUALIFIER',
            val: 'version',
          },
        ],
      },
      { input: '', expected: [zeroToken] },
    ];

    it('should tokenize', () => {
      for (const { input, expected } of testObj) {
        expect(tokenize(input)).toEqual(expected);
      }
    });
  });

  describe('Non-standard behavior', () => {
    describe('equality', () => {
      it.each`
        x              | y
        ${'1-ga-1'}    | ${'1-1'}
        ${'1.0-SNAP'}  | ${'1-snapshot'}
        ${'1.0rc'}     | ${'1.0-preview'}
        ${'v1.2.3'}    | ${'1.2.3'}
        ${'v0.0-1552'} | ${'0.0-1552'}
        ${'v0.0.1'}    | ${'0.0.1'}
      `('$x == $y', ({ x, y }) => {
        expect(compare(x, y)).toBe(0);
        expect(compare(y, x)).toBe(0);
      });
    });

    describe('ordering', () => {
      it.each`
        x              | y
        ${'1-snap'}    | ${'1'}
        ${'1-preview'} | ${'1-snapshot'}
      `('$x < $y', ({ x, y }) => {
        expect(compare(x, y)).toBe(-1);
        expect(compare(y, x)).toBe(1);
      });
    });
  });

  describe('Ranges', () => {
    it.each`
      input
      ${'1.2.3-SNAPSHOT'}
      ${'[]'}
      ${'[,]'}
      ${'('}
      ${'['}
      ${','}
      ${'[1.0'}
      ${'1.0]'}
      ${'[1.0],'}
      ${',[1.0]'}
      ${'(,1.1),(1.0,)'}
      ${'(0,1.1),(1.0,2.0)'}
      ${'(0,1.1),(,2.0)'}
      ${'(,1.0],,[1.2,)'}
      ${'(,1.0],[1.2,),'}
      ${'[1.5,]'}
      ${'[2.0,1.0)'}
      ${'[1.2,1.3],1.4'}
      ${'[1.2,,1.3]'}
      ${'[1.3,1.2]'}
      ${'[1,[2,3],4]'}
      ${'[,1.0]'}
      ${'[,1.0],[,1.0]'}
    `('filters out incorrect range: $input', ({ input }) => {
      const range = parseRange(input);
      expect(range).toBeNull();
      expect(rangeToStr(range)).toBeNull();
    });

    it.each`
      input           | leftType             | leftValue | leftBracket | rightType            | rightValue | rightBracket
      ${'[1.0]'}      | ${'INCLUDING_POINT'} | ${'1.0'}  | ${'['}      | ${'INCLUDING_POINT'} | ${'1.0'}   | ${']'}
      ${'(,1.0]'}     | ${'EXCLUDING_POINT'} | ${null}   | ${'('}      | ${'INCLUDING_POINT'} | ${'1.0'}   | ${']'}
      ${'(, 1.0]'}    | ${'EXCLUDING_POINT'} | ${null}   | ${'('}      | ${'INCLUDING_POINT'} | ${'1.0'}   | ${']'}
      ${'[1.2,1.3]'}  | ${'INCLUDING_POINT'} | ${'1.2'}  | ${'['}      | ${'INCLUDING_POINT'} | ${'1.3'}   | ${']'}
      ${'[1.2, 1.3]'} | ${'INCLUDING_POINT'} | ${'1.2'}  | ${'['}      | ${'INCLUDING_POINT'} | ${'1.3'}   | ${']'}
      ${'[1.0,2.0)'}  | ${'INCLUDING_POINT'} | ${'1.0'}  | ${'['}      | ${'EXCLUDING_POINT'} | ${'2.0'}   | ${')'}
      ${'[1.0,2.0)'}  | ${'INCLUDING_POINT'} | ${'1.0'}  | ${'['}      | ${'EXCLUDING_POINT'} | ${'2.0'}   | ${')'}
      ${'[1.5,)'}     | ${'INCLUDING_POINT'} | ${'1.5'}  | ${'['}      | ${'EXCLUDING_POINT'} | ${null}    | ${')'}
      ${'[1.5, )'}    | ${'INCLUDING_POINT'} | ${'1.5'}  | ${'['}      | ${'EXCLUDING_POINT'} | ${null}    | ${')'}
    `(
      'parseRange("$input")',
      ({
        input,
        leftType,
        leftValue,
        leftBracket,
        rightType,
        rightValue,
        rightBracket,
      }) => {
        const parseResult = [
          {
            leftType,
            leftValue,
            leftBracket,
            rightType,
            rightValue,
            rightBracket,
          },
        ];
        expect(parseRange(input)).toEqual(parseResult);
        expect(rangeToStr(parseResult as never)).toEqual(
          input.replace(/\s*/g, ''),
        );
      },
    );

    it.each`
      range                      | version      | expected
      ${'[1.2.3]'}               | ${'1.2.3'}   | ${'[1.2.3]'}
      ${'[1.2.3]'}               | ${'1.2.4'}   | ${'[1.2.4]'}
      ${'[1.0.0,1.2.3]'}         | ${'0.0.1'}   | ${'[1.0.0,1.2.3]'}
      ${'[1.0.0,1.2.3]'}         | ${'1.2.4'}   | ${'[1.0.0,1.2.4]'}
      ${'[1.0.0,1.2.23]'}        | ${'1.1.0'}   | ${'[1.0.0,1.2.23]'}
      ${'(,1.0]'}                | ${'2.0'}     | ${'(,2.0]'}
      ${'],1.0]'}                | ${'2.0'}     | ${'],2.0]'}
      ${'(,1.0)'}                | ${'2.0'}     | ${'(,3.0)'}
      ${'],1.0['}                | ${'2.0'}     | ${'],3.0['}
      ${'[1.0,1.2.3],[1.3,1.5)'} | ${'1.2.4'}   | ${'[1.0,1.2.4],[1.3,1.5)'}
      ${'[1.0,1.2.3],[1.3,1.5['} | ${'1.2.4'}   | ${'[1.0,1.2.4],[1.3,1.5['}
      ${'[1.2.3,)'}              | ${'1.2.4'}   | ${'[1.2.4,)'}
      ${'[1.2.3,['}              | ${'1.2.4'}   | ${'[1.2.4,['}
      ${'[1.2.3,]'}              | ${'1.2.4'}   | ${'[1.2.3,]'}
      ${'[0.21,0.22)'}           | ${'0.20.21'} | ${'[0.21,0.22)'}
      ${'[0.21,0.22)'}           | ${'0.21.1'}  | ${'[0.21,0.22)'}
      ${'[0.21,0.22.0)'}         | ${'0.22.1'}  | ${'[0.21,0.22.2)'}
      ${'[0.21,0.22)'}           | ${'0.23'}    | ${'[0.23,0.24)'}
      ${'[1.8,1.9)'}             | ${'1.9.0.1'} | ${'[1.9,1.10)'}
      ${'[1.8a,1.9)'}            | ${'1.9.0.1'} | ${'[1.8a,1.10)'}
      ${'[1.8,1.9.0)'}           | ${'1.9.0.1'} | ${'[1.8,1.10.0)'}
      ${'[1.8,1.9.0.0)'}         | ${'1.9.0.1'} | ${'[1.8,1.9.0.2)'}
      ${'[1.8,1.9.0.0)'}         | ${'1.10.1'}  | ${'[1.8,1.10.2.0)'}
      ${'[1.8,1.9)'}             | ${'1.9.1'}   | ${'[1.9,1.10)'}
      ${'[1.8,1.9)'}             | ${'1.10.0'}  | ${'[1.10,1.11)'}
      ${'[1.8,1.9)'}             | ${'1.10.1'}  | ${'[1.10,1.11)'}
      ${'(,1.0.0]'}              | ${'2.0.0'}   | ${'(,2.0.0]'}
      ${'(,1.0]'}                | ${'2.0.0'}   | ${'(,2.0]'}
      ${'(,1]'}                  | ${'2.0.0'}   | ${'(,2]'}
      ${'(,1.0.0-foobar]'}       | ${'2.0.0'}   | ${'(,2.0.0]'}
      ${'[1,2]'}                 | ${'2'}       | ${'[1,2]'}
      ${'[1,2)'}                 | ${'2'}       | ${'[2,3)'}
      ${'[0,2)'}                 | ${'2'}       | ${'[0,3)'}
      ${'[1.2,1.3]'}             | ${'1.3'}     | ${'[1.2,1.3]'}
      ${'[1.2,1.3)'}             | ${'1.3'}     | ${'[1.3,1.4)'}
      ${'[1.1,1.3)'}             | ${'1.3'}     | ${'[1.1,1.4)'}
      ${'[1.2.3,1.2.4]'}         | ${'1.2.4'}   | ${'[1.2.3,1.2.4]'}
      ${'[1.2.3,1.2.4)'}         | ${'1.2.4'}   | ${'[1.2.4,1.2.5)'}
      ${'[1.2.1,1.2.4)'}         | ${'1.2.4'}   | ${'[1.2.1,1.2.5)'}
      ${'[1,1.2.3)'}             | ${'1.2.3'}   | ${'[1,1.2.4)'}
    `(
      'autoExtendMavenRange("$range", "$version") === $expected',
      ({ range, version, expected }) => {
        expect(autoExtendMavenRange(range, version)).toEqual(expected);
      },
    );
  });
});
