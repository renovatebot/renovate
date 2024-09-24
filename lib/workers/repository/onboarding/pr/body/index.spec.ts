import type { RenovateConfig } from '../../../../../../test/util';
import { mocked, platform } from '../../../../../../test/util';
import { getConfig } from '../../../../../config/defaults';
import { GlobalConfig } from '../../../../../config/global';
import { logger } from '../../../../../logger';
import type { PackageFile } from '../../../../../modules/manager/types';
import type { BranchConfig } from '../../../../types';
import * as _baseBranch from './base-branch';
import * as _configDescription from './config-description';
import * as _prList from './pr-list';
import { getPrBody } from '.';

jest.mock('./pr-list');
const prList = mocked(_prList);

jest.mock('./config-description');
const configDescription = mocked(_configDescription);

jest.mock('./base-branch');
const baseBranch = mocked(_baseBranch);

describe('workers/repository/onboarding/pr/body/index', () => {
  describe('getPrBody', () => {
    let config: RenovateConfig;
    let packageFiles: Record<string, PackageFile[]>;
    let branches: BranchConfig[];

    beforeEach(() => {
      config = {
        ...getConfig(),
        errors: [],
        warnings: [],
        description: [],
        prFooter: undefined,
        prHeader: undefined,
      };
      packageFiles = {};
      branches = [];

      prList.getPrList.mockReturnValueOnce('getPrList');
      configDescription.getConfigDesc.mockReturnValueOnce('getConfigDesc');
      baseBranch.getBaseBranchDesc.mockReturnValueOnce('getBaseBranchDesc');
      platform.massageMarkdown.mockImplementation((x) => x);
      GlobalConfig.reset();
    });

    it('creates body without comments if maxbodylength is long enough', () => {
      platform.maxBodyLength.mockReturnValueOnce(Infinity);
      const template = 'PrBody';

      const res = getPrBody(template, packageFiles, config, branches, '');

      expect(res.body).toBe('PrBody');
      expect(res.comments).toEqual([]);
    });

    it('creates body with prFooter', () => {
      platform.maxBodyLength.mockReturnValue(Infinity);
      const template = 'PrBody';

      const res = getPrBody(
        template,
        packageFiles,
        { ...config, prFooter: 'Footer' },
        branches,
        '',
      );

      expect(res.body).toContain('Footer');
    });

    it('creates body with prHeader', () => {
      platform.maxBodyLength.mockReturnValue(Infinity);
      const template = 'PrBody';

      const res = getPrBody(
        template,
        packageFiles,
        { ...config, prHeader: 'Header' },
        branches,
        '',
      );

      expect(res.body).toStartWith('Header');
    });

    it('creates body with Pr List in comment', () => {
      platform.maxBodyLength.mockReturnValue('PrBody'.length);
      platform.massageMarkdown.mockImplementationOnce((x) => x);
      platform.massageMarkdown.mockImplementationOnce((_) => 'PrBody');
      const template = 'PrBody{{PRLIST}}';

      const res = getPrBody(template, packageFiles, config, branches, '');

      expect(res).toStrictEqual({
        body: 'PrBody',
        comments: [{ title: 'PR List', content: 'getPrList' }],
      });
    });

    it('creates body with Pr List & Package Files in comments', () => {
      platform.maxBodyLength.mockReturnValue('PrBody'.length);
      platform.massageMarkdown.mockImplementationOnce((x) => x);
      platform.massageMarkdown.mockImplementationOnce(
        (x) => 'PrBody{{PACKAGE FILES}}',
      );
      platform.massageMarkdown.mockImplementationOnce((_) => 'PrBody');
      packageFiles = { npm: [{ packageFile: 'package.json', deps: [] }] };
      const template = 'PrBody{{PRLIST}}{{PACKAGE FILES}}';

      const res = getPrBody(template, packageFiles, config, branches, '');

      expect(res).toStrictEqual({
        body: 'PrBody',
        comments: [
          { title: 'PR List', content: 'getPrList' },
          {
            title: 'Package Files',
            content: '### Detected Package Files\n\n * `package.json` (npm)\n',
          },
        ],
      });
    });

    it('creates & truncates body if body is too long', () => {
      platform.maxBodyLength.mockReturnValue(2);
      platform.massageMarkdown.mockImplementationOnce((x) => x);
      platform.massageMarkdown.mockImplementationOnce(
        (x) => 'PrBody{{PACKAGE FILES}}',
      );
      platform.massageMarkdown.mockImplementationOnce((_) => 'PrBody');
      packageFiles = { npm: [{ packageFile: 'package.json', deps: [] }] };
      const template = 'PrBody{{PRLIST}}{{PACKAGE FILES}}';

      const res = getPrBody(template, packageFiles, config, branches, '');

      expect(res.body).toBe('Pr');
    });

    it('creates body with empty configDescription if dryRun', () => {
      platform.maxBodyLength.mockReturnValueOnce(Infinity);
      const template = '{{CONFIG}}\n';
      GlobalConfig.set({ dryRun: 'full' });

      const res = getPrBody(template, packageFiles, config, branches, '');

      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would check branch renovate/configure',
      );
      expect(res.body).toBe('');
    });

    it('creates body with footer and header using templating', () => {
      platform.maxBodyLength.mockReturnValue(Infinity);
      const template = '';

      const res = getPrBody(
        template,
        packageFiles,
        {
          ...config,
          prFooter:
            'And this is a footer for repository:{{repository}} baseBranch:{{baseBranch}}',
          prHeader: 'This is a header for platform:{{platform}}',
          baseBranch: 'some-branch',
          repository: 'test',
        },
        branches,
        '',
      );

      expect(res.body).toStartWith('This is a header for platform:github');

      expect(res.body).toEndWith(
        'And this is a footer for repository:test baseBranch:some-branch\n',
      );
    });

    it('creates & truncates comments if comment is too long', () => {
      platform.maxBodyLength.mockReturnValue('PrBody'.length);
      platform.maxCommentLength.mockReturnValue(3);
      platform.massageMarkdown.mockImplementationOnce((x) => x);
      platform.massageMarkdown.mockImplementationOnce(
        (x) => 'PrBody{{PACKAGE FILES}}',
      );
      platform.massageMarkdown.mockImplementationOnce((_) => 'PrBody');
      packageFiles = { npm: [{ packageFile: 'package.json', deps: [] }] };
      const template = 'PrBody{{PRLIST}}{{PACKAGE FILES}}';

      const res = getPrBody(template, packageFiles, config, branches, '');

      expect(res).toStrictEqual({
        body: 'PrBody',
        comments: [
          { title: 'PR List', content: 'get' },
          {
            title: 'Package Files',
            content: '###',
          },
        ],
      });
    });
  });
});
