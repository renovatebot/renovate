import { codeBlock } from 'common-tags';
import { describe } from 'vitest';
import { Fixtures } from '~test/fixtures.ts';
import { getDefaultVersioning } from '../../datasource/common.ts';
import * as allVersioning from '../../versioning/index.ts';
import { convertGoDirectiveToSemVerRange } from './extract.ts';
import { extractPackageFile } from './index.ts';

const gomod1 = Fixtures.get('1/go-mod');
const gomod2 = Fixtures.get('2/go-mod');

describe('modules/manager/gomod/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts single-line requires', () => {
      const res = extractPackageFile(gomod1)?.deps;
      expect(res).toEqual([
        {
          currentValue: 'v0.7.0',
          datasource: 'go',
          depName: 'github.com/pkg/errors',
          depType: 'require',
          managerData: {
            lineNumber: 2,
          },
        },
        {
          currentValue: 'v1.15.21',
          datasource: 'go',
          depName: 'github.com/aws/aws-sdk-go',
          depType: 'require',
          managerData: {
            lineNumber: 3,
          },
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'go',
          depName: 'github.com/davecgh/go-spew',
          depType: 'indirect',
          enabled: false,
          managerData: {
            lineNumber: 4,
          },
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'go',
          depName: 'golang.org/x/foo',
          depType: 'require',
          managerData: {
            lineNumber: 5,
          },
        },
        {
          currentValue: 'abcdef1',
          datasource: 'go',
          depName: 'github.com/rarkins/foo',
          depType: 'require',
          managerData: {
            lineNumber: 6,
          },
          skipReason: 'invalid-version',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'go',
          depName: 'gopkg.in/russross/blackfriday.v1',
          depType: 'require',
          managerData: {
            lineNumber: 7,
          },
        },
        {
          currentValue: 'v25.1.0+incompatible',
          datasource: 'go',
          depName: 'github.com/Azure/azure-sdk-for-go',
          depType: 'require',
          managerData: {
            lineNumber: 8,
          },
        },
        {
          datasource: 'go',
          depName: '../errors',
          depType: 'replace',
          managerData: {
            lineNumber: 10,
          },
          skipReason: 'local-dependency',
        },
        {
          currentValue: 'v0.0.0',
          datasource: 'go',
          depName: 'github.com/pravesht/gocql',
          depType: 'replace',
          managerData: {
            lineNumber: 11,
          },
        },
        {
          currentValue: 'v3.5.0+incompatible',
          datasource: 'go',
          depName: 'github.com/caarlos0/env',
          depType: 'require',
          managerData: {
            lineNumber: 13,
          },
        },
        {
          currentValue: 'v4.7.0',
          datasource: 'go',
          depName: 'sigs.k8s.io/structured-merge-diff/v4',
          depType: 'require',
          managerData: {
            lineNumber: 15,
          },
        },
        {
          currentValue: 'v18.0.0',
          datasource: 'go',
          depName: 'github.com/cucumber/common/messages/go/v18',
          depType: 'require',
          managerData: {
            lineNumber: 16,
          },
        },
      ]);
      expect(res).toHaveLength(12);
      expect(res?.filter((e) => e.depType === 'require')).toHaveLength(9);
      expect(res?.filter((e) => e.depType === 'indirect')).toHaveLength(1);
      expect(res?.filter((e) => e.skipReason)).toHaveLength(2);
      expect(res?.filter((e) => e.depType === 'replace')).toHaveLength(2);
    });

    it('extracts multi-line requires', () => {
      const res = extractPackageFile(gomod2)?.deps;
      expect(res).toEqual([
        {
          currentValue: 'v1.15.21',
          datasource: 'go',
          depName: 'github.com/aws/aws-sdk-go',
          depType: 'require',
          managerData: {
            lineNumber: 3,
            multiLine: true,
          },
        },
        {
          currentDigest: '9fd32a8b3d3d',
          currentValue: 'v0.0.0-20140422174119-9fd32a8b3d3d',
          datasource: 'go',
          depName: 'github.com/bgentry/go-netrc',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 4,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'bcc4c8345a21',
          currentValue: 'v0.0.0-20151120183258-bcc4c8345a21',
          datasource: 'go',
          depName: 'github.com/cloudfoundry/jibber_jabber',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 5,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v1.1.0',
          datasource: 'go',
          depName: 'github.com/davecgh/go-spew',
          depType: 'require',
          managerData: {
            lineNumber: 6,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.9.0',
          datasource: 'go',
          depName: 'github.com/emirpasic/gods',
          depType: 'require',
          managerData: {
            lineNumber: 7,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.7.0',
          datasource: 'go',
          depName: 'github.com/fatih/color',
          depType: 'require',
          managerData: {
            lineNumber: 8,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.4.7',
          datasource: 'go',
          depName: 'github.com/fsnotify/fsnotify',
          depType: 'require',
          managerData: {
            lineNumber: 9,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.38.2',
          datasource: 'go',
          depName: 'github.com/go-ini/ini',
          depType: 'require',
          managerData: {
            lineNumber: 10,
            multiLine: true,
          },
        },
        {
          currentDigest: '604e922904d3',
          currentValue: 'v0.0.0-20130729185459-604e922904d3',
          datasource: 'go',
          depName: 'github.com/golang-collections/collections',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 11,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'd5fe4b57a186',
          currentValue: 'v0.0.0-20171218145408-d5fe4b57a186',
          datasource: 'go',
          depName: 'github.com/hashicorp/go-cleanhttp',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 12,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: '4bda8fa99001',
          currentValue: 'v0.0.0-20180809191950-4bda8fa99001',
          datasource: 'go',
          depName: 'github.com/hashicorp/go-getter',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 13,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'b1a1dbde6fdc',
          currentValue: 'v0.0.0-20180326211150-b1a1dbde6fdc',
          datasource: 'go',
          depName: 'github.com/hashicorp/go-safetemp',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 14,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'go',
          depName: 'github.com/hashicorp/go-version',
          depType: 'require',
          managerData: {
            lineNumber: 15,
            multiLine: true,
          },
        },
        {
          currentDigest: 'ef8a98b0bbce',
          currentValue: 'v0.0.0-20180404174102-ef8a98b0bbce',
          datasource: 'go',
          depName: 'github.com/hashicorp/hcl',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 16,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'fc0cef2ff331',
          currentValue: 'v0.0.0-20180515183152-fc0cef2ff331',
          datasource: 'go',
          depName: 'github.com/heroku/rollrus',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 17,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'd14ea06fba99',
          currentValue: 'v0.0.0-20150711004518-d14ea06fba99',
          datasource: 'go',
          depName: 'github.com/jbenet/go-context',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 18,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: '906e15686e63',
          currentValue: 'v0.0.0-20180822080847-906e15686e63',
          datasource: 'go',
          depName: 'github.com/jesseduffield/go-getter',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 19,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: '03e26ff3f1de',
          currentValue: 'v0.0.0-20180921065632-03e26ff3f1de',
          datasource: 'go',
          depName: 'github.com/jesseduffield/gocui',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 20,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: '1e272ff78dcb',
          currentValue: 'v0.0.0-20180919093808-1e272ff78dcb',
          datasource: 'go',
          depName: 'github.com/jesseduffield/termbox-go',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 21,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: '0b12d6b521d8',
          currentValue: 'v0.0.0-20160202185014-0b12d6b521d8',
          datasource: 'go',
          depName: 'github.com/jmespath/go-jmespath',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 22,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'ae77be60afb1',
          currentValue: 'v0.0.0-20170510131534-ae77be60afb1',
          datasource: 'go',
          depName: 'github.com/kardianos/osext',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 23,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: '9fc7bb800b55',
          currentValue: 'v0.0.0-20180317175531-9fc7bb800b55',
          datasource: 'go',
          depName: 'github.com/kevinburke/ssh_config',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 24,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v1.8.0',
          datasource: 'go',
          depName: 'github.com/magiconair/properties',
          depType: 'require',
          managerData: {
            lineNumber: 25,
            multiLine: true,
          },
        },
        {
          currentValue: 'v0.0.9',
          datasource: 'go',
          depName: 'github.com/mattn/go-colorable',
          depType: 'require',
          managerData: {
            lineNumber: 26,
            multiLine: true,
          },
        },
        {
          currentValue: 'v0.0.3',
          datasource: 'go',
          depName: 'github.com/mattn/go-isatty',
          depType: 'require',
          managerData: {
            lineNumber: 27,
            multiLine: true,
          },
        },
        {
          currentValue: 'v0.0.2',
          datasource: 'go',
          depName: 'github.com/mattn/go-runewidth',
          depType: 'require',
          managerData: {
            lineNumber: 28,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.2.0',
          datasource: 'go',
          depName: 'github.com/mgutz/str',
          depType: 'require',
          managerData: {
            lineNumber: 29,
            multiLine: true,
          },
        },
        {
          currentDigest: '58046073cbff',
          currentValue: 'v0.0.0-20180801233206-58046073cbff',
          datasource: 'go',
          depName: 'github.com/mitchellh/go-homedir',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 30,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'a61a99592b77',
          currentValue: 'v0.0.0-20171004221916-a61a99592b77',
          datasource: 'go',
          depName: 'github.com/mitchellh/go-testing-interface',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 31,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'f15292f7a699',
          currentValue: 'v0.0.0-20180715050151-f15292f7a699',
          datasource: 'go',
          depName: 'github.com/mitchellh/mapstructure',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 32,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'a16b91a3ba80',
          currentValue: 'v0.0.0-20180803040939-a16b91a3ba80',
          datasource: 'go',
          depName: 'github.com/nicksnyder/go-i18n',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 33,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v0.2.0',
          datasource: 'go',
          depName: 'github.com/pelletier/go-buffruneio',
          depType: 'require',
          managerData: {
            lineNumber: 34,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.2.0',
          datasource: 'go',
          depName: 'github.com/pelletier/go-toml',
          depType: 'require',
          managerData: {
            lineNumber: 35,
            multiLine: true,
          },
        },
        {
          currentValue: 'v0.8.0',
          datasource: 'go',
          depName: 'github.com/pkg/errors',
          depType: 'require',
          managerData: {
            lineNumber: 36,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'go',
          depName: 'github.com/pmezard/go-difflib',
          depType: 'require',
          managerData: {
            lineNumber: 37,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'go',
          depName: 'github.com/sergi/go-diff',
          depType: 'require',
          managerData: {
            lineNumber: 38,
            multiLine: true,
          },
        },
        {
          currentDigest: 'e180dbdc8da0',
          currentValue: 'v0.0.0-20170330084843-e180dbdc8da0',
          datasource: 'go',
          depName: 'github.com/shibukawa/configdir',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 39,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v1.0.6',
          datasource: 'go',
          depName: 'github.com/sirupsen/logrus',
          depType: 'require',
          managerData: {
            lineNumber: 40,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.1.1',
          datasource: 'go',
          depName: 'github.com/spf13/afero',
          depType: 'require',
          managerData: {
            lineNumber: 41,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.2.0',
          datasource: 'go',
          depName: 'github.com/spf13/cast',
          depType: 'require',
          managerData: {
            lineNumber: 42,
            multiLine: true,
          },
        },
        {
          currentDigest: '14d3d4c51834',
          currentValue: 'v0.0.0-20180814060501-14d3d4c51834',
          datasource: 'go',
          depName: 'github.com/spf13/jwalterweatherman',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 43,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v1.0.2',
          datasource: 'go',
          depName: 'github.com/spf13/pflag',
          depType: 'require',
          managerData: {
            lineNumber: 44,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.1.0',
          datasource: 'go',
          depName: 'github.com/spf13/viper',
          depType: 'require',
          managerData: {
            lineNumber: 45,
            multiLine: true,
          },
        },
        {
          currentDigest: '59b7046e48ad',
          currentValue: 'v0.0.0-20160624110644-59b7046e48ad',
          datasource: 'go',
          depName: 'github.com/spkg/bom',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 46,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v2.3.0',
          datasource: 'go',
          depName: 'github.com/src-d/gcfg/v2',
          depType: 'require',
          managerData: {
            lineNumber: 47,
            multiLine: true,
          },
        },
        {
          currentValue: 'v1.2.2',
          datasource: 'go',
          depName: 'github.com/stretchr/testify',
          depType: 'require',
          managerData: {
            lineNumber: 48,
            multiLine: true,
          },
        },
        {
          currentDigest: '3627a5cbeaea',
          currentValue: 'v0.0.0-20170522205222-3627a5cbeaea',
          datasource: 'go',
          depName: 'github.com/stvp/roll',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 49,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v0.1.2',
          datasource: 'go',
          depName: 'github.com/tcnksm/go-gitconfig',
          depType: 'require',
          managerData: {
            lineNumber: 50,
            multiLine: true,
          },
        },
        {
          currentValue: 'v0.5.4',
          datasource: 'go',
          depName: 'github.com/ulikunitz/xz',
          depType: 'require',
          managerData: {
            lineNumber: 51,
            multiLine: true,
          },
        },
        {
          currentValue: 'v0.2.0',
          datasource: 'go',
          depName: 'github.com/xanzy/ssh-agent',
          depType: 'require',
          managerData: {
            lineNumber: 52,
            multiLine: true,
          },
        },
        {
          currentDigest: 'de0752318171',
          currentValue: 'v0.0.0-20180808211826-de0752318171',
          datasource: 'go',
          depName: 'golang.org/x/crypto',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 53,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: 'c39426892332',
          currentValue: 'v0.0.0-20180811021610-c39426892332',
          datasource: 'go',
          depName: 'golang.org/x/net',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 54,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentDigest: '98c5dad5d1a0',
          currentValue: 'v0.0.0-20180810173357-98c5dad5d1a0',
          datasource: 'go',
          depName: 'golang.org/x/sys',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 55,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v0.3.0',
          datasource: 'go',
          depName: 'golang.org/x/text',
          depType: 'require',
          managerData: {
            lineNumber: 56,
            multiLine: true,
          },
        },
        {
          currentValue: 'v4.2.0',
          datasource: 'go',
          depName: 'gopkg.in/src-d/go-billy.v4',
          depType: 'require',
          managerData: {
            lineNumber: 57,
            multiLine: true,
          },
        },
        {
          currentDigest: '43d17e14b714',
          currentValue: 'v4.0.0-20180807092216-43d17e14b714',
          datasource: 'go',
          depName: 'gopkg.in/src-d/go-git.v4',
          depType: 'require',
          digestOneAndOnly: true,
          managerData: {
            lineNumber: 58,
            multiLine: true,
          },
          versioning: 'loose',
        },
        {
          currentValue: 'v0.1.2',
          datasource: 'go',
          depName: 'gopkg.in/warnings.v0',
          depType: 'require',
          managerData: {
            lineNumber: 59,
            multiLine: true,
          },
        },
        {
          currentValue: 'v2.2.1',
          datasource: 'go',
          depName: 'gopkg.in/yaml.v2',
          depType: 'require',
          managerData: {
            lineNumber: 60,
            multiLine: true,
          },
        },
        {
          currentDigest: 'd98b1b443823',
          currentValue: 'v0.0.0-20191003171128-d98b1b443823',
          datasource: 'go',
          depName: 'golang.org/x/net',
          depType: 'indirect',
          digestOneAndOnly: true,
          enabled: false,
          managerData: {
            lineNumber: 61,
            multiLine: true,
          },
          versioning: 'loose',
        },
      ]);
      expect(res).toHaveLength(59);
      expect(res?.filter((e) => e.skipReason)).toHaveLength(0);
      expect(res?.filter((e) => e.depType === 'indirect')).toHaveLength(1);
    });

    it('ignores empty spaces in multi-line requires', () => {
      const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go 1.19
        require (
        	cloud.google.com/go v0.45.1

        	github.com/Microsoft/go-winio v0.4.15-0.20190919025122-fc70bd9a86b5 // indirect
        )
      `;
      const res = extractPackageFile(goMod)?.deps;
      expect(res).toHaveLength(3);
    });

    it('extracts replace directives from multi-line and single line', () => {
      const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go 1.23
        replace golang.org/x/foo => github.com/pravesht/gocql v0.0.0
        replace (
              k8s.io/client-go => k8s.io/client-go v0.21.9
              )
        replace (
          k8s.io/cloud-provider => k8s.io/cloud-provider v0.17.3
          k8s.io/cluster-bootstrap => k8s.io/cluster-bootstrap v0.17.3 // indirect
          k8s.io/code-generator => k8s.io/code-generator v0.17.3
        )
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            managerData: {
              lineNumber: 1,
            },
            depName: 'go',
            depType: 'golang',
            currentValue: '1.23',
            datasource: 'golang-version',
            versioning: 'go-mod-directive',
            commitMessageTopic: 'go module directive',
          },
          {
            managerData: {
              lineNumber: 2,
            },
            depName: 'github.com/pravesht/gocql',
            depType: 'replace',
            currentValue: 'v0.0.0',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 4,
              multiLine: true,
            },
            depName: 'k8s.io/client-go',
            depType: 'replace',
            currentValue: 'v0.21.9',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 7,
              multiLine: true,
            },
            depName: 'k8s.io/cloud-provider',
            depType: 'replace',
            currentValue: 'v0.17.3',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 8,
              multiLine: true,
            },
            depName: 'k8s.io/cluster-bootstrap',
            depType: 'indirect',
            enabled: false,
            currentValue: 'v0.17.3',
            datasource: 'go',
          },
          {
            managerData: {
              lineNumber: 9,
              multiLine: true,
            },
            depName: 'k8s.io/code-generator',
            depType: 'replace',
            currentValue: 'v0.17.3',
            datasource: 'go',
          },
        ],
        extractedConstraints: {
          '%goMod': '~1.23.x',
        },
        constraintsVersioning: {
          '%goMod': 'semver-coerced',
        },
      });
    });

    it('extracts replace directives from non-public module path', () => {
      const goMod = codeBlock`
        module github.com/JamieTanna-Mend-testing/tka-9783-golang-pro-main
        go 1.25.5
        require pro-lib v0.0.0-00010101000000-000000000000
        replace pro-lib => github.com/ns-rpro-dev-tests/golang-pro-lib/libs/src/ns v0.0.0-20260219031232-e6910bd8fb97
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            managerData: {
              lineNumber: 1,
            },
            depName: 'go',
            depType: 'golang',
            currentValue: '1.25.5',
            datasource: 'golang-version',
            versioning: 'go-mod-directive',
            commitMessageTopic: 'go module directive',
          },
          {
            managerData: {
              lineNumber: 2,
            },
            depName: 'pro-lib',
            depType: 'require',
            currentValue: 'v0.0.0-00010101000000-000000000000',
            currentDigest: '000000000000',
            datasource: 'go',
            digestOneAndOnly: true,
            versioning: 'loose',
            skipReason: 'invalid-version',
          },
          {
            managerData: {
              lineNumber: 3,
            },
            depName: 'github.com/ns-rpro-dev-tests/golang-pro-lib/libs/src/ns',
            depType: 'replace',
            currentValue: 'v0.0.0-20260219031232-e6910bd8fb97',
            currentDigest: 'e6910bd8fb97',
            datasource: 'go',
            digestOneAndOnly: true,
            versioning: 'loose',
          },
        ],
        extractedConstraints: {
          '%goMod': '~1.25.x',
        },
        constraintsVersioning: {
          '%goMod': 'semver-coerced',
        },
      });
    });

    // https://go.dev/doc/modules/gomod-ref#exclude
    it('ignores exclude directives from multi-line and single line', () => {
      const goMod = codeBlock`
        module github.com/renovate-tests/gomod

        exclude github.com/pravesht/gocql v0.0.0

        exclude (
              k8s.io/client-go v0.21.9
              )
        exclude (
          k8s.io/cloud-provider v0.17.3
          k8s.io/cluster-bootstrap v0.17.3 // indirect
          k8s.io/code-generator v0.17.3
        )
      `;
      const res = extractPackageFile(goMod);
      expect(res).toBeNull();
    });

    it('extracts the toolchain directive', () => {
      const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go 1.23
        toolchain go1.23.3
        replace golang.org/x/foo => github.com/pravesht/gocql v0.0.0
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            managerData: {
              lineNumber: 1,
            },
            depName: 'go',
            depType: 'golang',
            currentValue: '1.23',
            datasource: 'golang-version',
            versioning: 'go-mod-directive',
            commitMessageTopic: 'go module directive',
          },
          {
            managerData: {
              lineNumber: 2,
            },
            depName: 'go',
            depType: 'toolchain',
            currentValue: '1.23.3',
            datasource: 'golang-version',
            commitMessageTopic: 'go toolchain directive',
          },
          {
            managerData: {
              lineNumber: 3,
            },
            depName: 'github.com/pravesht/gocql',
            depType: 'replace',
            currentValue: 'v0.0.0',
            datasource: 'go',
          },
        ],
        extractedConstraints: {
          '%goMod': '~1.23.x',
          golang: '1.23.3',
        },
        constraintsVersioning: {
          '%goMod': 'semver-coerced',
        },
      });
    });

    it('extracts single-line tool directives', () => {
      const goMod = codeBlock`
        require github.com/oapi-codegen/oapi-codegen/v2 v2.4.1 // indirect
        tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            datasource: 'go',
            depName: 'github.com/oapi-codegen/oapi-codegen/v2',
            depType: 'indirect',
            currentValue: 'v2.4.1',
            managerData: { lineNumber: 0 },
          },
        ],
      });
    });

    it('extracts multi-line tool directives', () => {
      const goMod = codeBlock`
        require github.com/oapi-codegen/oapi-codegen/v2 v2.4.1 // indirect
        tool (
          github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen
        )
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            datasource: 'go',
            depName: 'github.com/oapi-codegen/oapi-codegen/v2',
            depType: 'indirect',
            currentValue: 'v2.4.1',
            managerData: { lineNumber: 0 },
          },
        ],
      });
    });
  });

  it('extracts tool directives with required modules', () => {
    const goMod = codeBlock`
        require github.com/oapi-codegen/oapi-codegen/v2 v2.4.1
        tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen
      `;
    const res = extractPackageFile(goMod);
    expect(res).toEqual({
      deps: [
        {
          datasource: 'go',
          depName: 'github.com/oapi-codegen/oapi-codegen/v2',
          depType: 'require',
          currentValue: 'v2.4.1',
          managerData: { lineNumber: 0 },
        },
      ],
    });
  });

  it('extracts tool directives of sub-modules', () => {
    const goMod = codeBlock`
        require (
          github.com/foo/bar v1.2.3
          github.com/foo/bar/sub1/sub2 v4.5.6 // indirect
          github.com/foo/bar/sub1 v7.8.9 // indirect
          github.com/foo/bar/sub1/sub2/cmd/hell v10.11.12 // indirect
        )
        tool github.com/foo/bar/sub1/sub2/cmd/hello
      `;
    const res = extractPackageFile(goMod);
    expect(res).toEqual({
      deps: [
        {
          datasource: 'go',
          depName: 'github.com/foo/bar',
          depType: 'require',
          currentValue: 'v1.2.3',
          managerData: { lineNumber: 1, multiLine: true },
        },
        {
          datasource: 'go',
          depName: 'github.com/foo/bar/sub1/sub2',
          depType: 'indirect',
          currentValue: 'v4.5.6',
          managerData: { lineNumber: 2, multiLine: true },
        },
        {
          datasource: 'go',
          depName: 'github.com/foo/bar/sub1',
          depType: 'indirect',
          currentValue: 'v7.8.9',
          enabled: false,
          managerData: { lineNumber: 3, multiLine: true },
        },
        {
          datasource: 'go',
          depName: 'github.com/foo/bar/sub1/sub2/cmd/hell',
          depType: 'indirect',
          currentValue: 'v10.11.12',
          enabled: false,
          managerData: { lineNumber: 4, multiLine: true },
        },
      ],
    });
  });

  it('extracts tool directives with exact match', () => {
    const goMod = codeBlock`
        require github.com/foo/bar v1.2.3 // indirect
        tool github.com/foo/bar
      `;
    const res = extractPackageFile(goMod);
    expect(res).toEqual({
      deps: [
        {
          datasource: 'go',
          depName: 'github.com/foo/bar',
          depType: 'indirect',
          currentValue: 'v1.2.3',
          managerData: { lineNumber: 0 },
        },
      ],
    });
  });

  it('extracts tool directives with no matching dependencies', () => {
    const goMod = codeBlock`
        tool github.com/foo/bar/sub/cmd/hello
      `;
    const res = extractPackageFile(goMod);
    expect(res).toBeNull();
  });

  /**
   *
   * https://go.dev/doc/modules/gomod-ref#retract
   * https://go.dev/doc/modules/gomod-ref#godebug
   */
  it('ignores directives unrelated to dependencies', () => {
    const goMod = codeBlock`
        module github.com/renovate-tests/gomod

        godebug asynctimerchan=0

        godebug (
          default=go1.21
          panicnil=1
        )

        retract v3.0.0

        retract [v2.0.0,v2.0.5] // Build broken on some platforms.

        retract (
            v1.0.0 // Published accidentally.
            v1.0.1 // Contains retractions only.
        )
      `;
    const res = extractPackageFile(goMod);
    expect(res).toBeNull();
  });

  it('marks placeholder pseudo versions with skipReason invalid-version', () => {
    const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go 1.19
        require (
          github.com/foo/bar v1.2.3
          github.com/baz/qux v0.0.0-00010101000000-000000000000
          github.com/example/local v0.0.0-00010101000000-000000000000 // indirect
          github.com/non/placeholder v1.2.4-0.20230101120000-abcdef123456
          monorepo v0.0.0-00010101000000-000000000000
        )
      `;
    const res = extractPackageFile(goMod);
    expect(res).toEqual({
      deps: [
        {
          managerData: {
            lineNumber: 1,
          },
          depName: 'go',
          depType: 'golang',
          currentValue: '1.19',
          datasource: 'golang-version',
          versioning: 'go-mod-directive',
          commitMessageTopic: 'go module directive',
        },
        {
          managerData: {
            lineNumber: 3,
            multiLine: true,
          },
          depName: 'github.com/foo/bar',
          depType: 'require',
          currentValue: 'v1.2.3',
          datasource: 'go',
        },
        {
          managerData: {
            lineNumber: 4,
            multiLine: true,
          },
          depName: 'github.com/baz/qux',
          depType: 'require',
          currentValue: 'v0.0.0-00010101000000-000000000000',
          datasource: 'go',
          skipReason: 'invalid-version',
          currentDigest: '000000000000',
          digestOneAndOnly: true,
          versioning: 'loose',
        },
        {
          managerData: {
            lineNumber: 5,
            multiLine: true,
          },
          depName: 'github.com/example/local',
          depType: 'indirect',
          currentValue: 'v0.0.0-00010101000000-000000000000',
          datasource: 'go',
          skipReason: 'invalid-version',
          enabled: false,
          currentDigest: '000000000000',
          digestOneAndOnly: true,
          versioning: 'loose',
        },
        {
          managerData: {
            lineNumber: 6,
            multiLine: true,
          },
          depName: 'github.com/non/placeholder',
          depType: 'require',
          currentValue: 'v1.2.4-0.20230101120000-abcdef123456',
          datasource: 'go',
          currentDigest: 'abcdef123456',
          digestOneAndOnly: true,
          versioning: 'loose',
        },
        {
          managerData: {
            lineNumber: 7,
            multiLine: true,
          },
          depName: 'monorepo',
          depType: 'require',
          currentValue: 'v0.0.0-00010101000000-000000000000',
          datasource: 'go',
          currentDigest: '000000000000',
          digestOneAndOnly: true,
          versioning: 'loose',
          skipReason: 'invalid-version',
        },
      ],
      extractedConstraints: {
        '%goMod': '~1.19.x',
      },
      constraintsVersioning: {
        '%goMod': 'semver-coerced',
      },
    });
  });

  it.each(['1.19', '1.19.0', '1.19.5'])(
    'extracts `go` directive %s as a `%goMod` extracted constraint as a SemVer-minor compatible range',
    (goDirective) => {
      const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go ${goDirective}
      `;
      const res = extractPackageFile(goMod);
      expect(res).toEqual({
        deps: [
          {
            managerData: {
              lineNumber: 1,
            },
            depName: 'go',
            depType: 'golang',
            currentValue: goDirective,
            datasource: 'golang-version',
            versioning: 'go-mod-directive',
            commitMessageTopic: 'go module directive',
          },
        ],
        extractedConstraints: {
          // NOTE that this is extracted as a range for the whole SemVer minor version
          '%goMod': '~1.19.x',
        },
        constraintsVersioning: {
          '%goMod': 'semver-coerced',
        },
      });
    },
  );

  describe('the extracted version can be used as a SemVer constraint', () => {
    const goMod = codeBlock`
        module github.com/renovate-tests/gomod
        go 1.19
      `;
    const res = extractPackageFile(goMod);

    const datasourceVersioningName = getDefaultVersioning(
      res!.deps[0].datasource,
    );
    const versioningName = res!.constraintsVersioning!['%goMod'];
    const versioning = allVersioning.get(versioningName);
    const constraint = res!.extractedConstraints!['%goMod']!;

    it('extracts the expected versioning and constraints', () => {
      // NOTE that this is not the `go-mod-directive` versioning, as that comes from `constraintsVersioning`
      expect(datasourceVersioningName).toEqual('semver');
      expect(res!.constraintsVersioning).toBeDefined();
      expect(versioningName).toBeDefined();
      expect(versioning).toBeDefined();
    });

    it(`${constraint} is a valid constraint`, () => {
      expect(versioning.isValid(constraint)).toBeTrue();
    });

    it('matches version 1.19, even though it is not valid SemVer', () => {
      expect(versioning.matches('1.19', constraint)).toBeTrue();
    });

    it('matches the current SemVer minor', () => {
      expect(versioning.matches('1.19.0', constraint)).toBeTrue();
      expect(versioning.matches('1.19.10', constraint)).toBeTrue();
    });

    it('does not match the next SemVer minor', () => {
      expect(versioning.matches('1.20.0', constraint)).toBeFalse();
      expect(versioning.matches('1.20.10', constraint)).toBeFalse();
    });

    it('does not match the previous SemVer minor', () => {
      expect(versioning.matches('1.18.0', constraint)).toBeFalse();
      expect(versioning.matches('1.18.5', constraint)).toBeFalse();
    });
  });

  describe('convertGoDirectiveToSemVerRange()', () => {
    it('handles undefined go directive', () => {
      const goDirective = undefined;
      const semVerRange = convertGoDirectiveToSemVerRange(goDirective);
      expect(semVerRange.version).toBeUndefined();
    });
  });
});
