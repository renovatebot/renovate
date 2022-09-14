import { Fixtures } from '../../../../../test/fixtures';
import { getConfig, partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { WORKER_FILE_UPDATE_FAILED } from '../../../../constants/error-messages';
import { extractPackageFile } from '../../../../modules/manager/html';
import type { BranchUpgradeConfig } from '../../../types';
import { doAutoReplace } from './auto-replace';

const sampleHtml = Fixtures.get(
  'sample.html',
  `../../../../modules/manager/html`
);

jest.mock('fs-extra', () => Fixtures.fsExtra());

describe('workers/repository/update/branch/auto-replace', () => {
  describe('doAutoReplace', () => {
    let reuseExistingBranch: boolean;
    let upgrade: BranchUpgradeConfig;

    beforeAll(() => {
      GlobalConfig.set({
        localDir: '/temp',
      });
    });

    beforeEach(() => {
      upgrade = partial<BranchUpgradeConfig>({
        // TODO: fix types (#7154)
        ...(getConfig() as any),
        manager: 'html',
        packageFile: 'test',
      });
      reuseExistingBranch = false;
    });

    it('rebases if the deps list has changed', async () => {
      upgrade.baseDeps = extractPackageFile(sampleHtml)?.deps;
      reuseExistingBranch = true;
      const res = await doAutoReplace(
        upgrade,
        'existing content',
        reuseExistingBranch
      );
      expect(res).toBeNull();
    });

    it('rebases if the deps to update has changed', async () => {
      upgrade.baseDeps = extractPackageFile(sampleHtml)?.deps;
      upgrade.baseDeps![0].currentValue = '1.0.0';
      reuseExistingBranch = true;
      const res = await doAutoReplace(upgrade, sampleHtml, reuseExistingBranch);
      expect(res).toBeNull();
    });

    it('updates version only', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}   `;
      upgrade.baseDeps = extractPackageFile(src)?.deps;
      upgrade.depName = 'reactstrap';
      upgrade.packageName = 'reactstrap/7.1.0/reactstrap.min.js';
      upgrade.currentValue = '7.1.0';
      upgrade.newValue = '7.1.1';
      upgrade.newDigest = 'some-digest';
      upgrade.depIndex = 0;
      const res = await doAutoReplace(upgrade, src, reuseExistingBranch);
      expect(res).toEqual(src.replace('7.1.0', '7.1.1'));
    });

    it('handles a double attempt', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}  ${script} `;
      upgrade.baseDeps = extractPackageFile(src)?.deps;
      upgrade.depName = 'reactstrap';
      upgrade.packageName = 'reactstrap/7.1.0/reactstrap.min.js';
      upgrade.currentValue = '7.1.0';
      upgrade.newValue = '7.1.1';
      upgrade.depIndex = 1;
      const res = await doAutoReplace(upgrade, src, reuseExistingBranch);
      expect(res).toBe(`     ${script}  ${script.replace('7.1.0', '7.1.1')} `);
    });

    it('handles already updated', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}   `;
      upgrade.baseDeps = extractPackageFile(src)?.deps;
      upgrade.depName = 'reactstrap';
      upgrade.packageName = 'reactstrap/7.1.0/reactstrap.min.js';
      upgrade.currentValue = '7.1.0';
      upgrade.newValue = '7.1.1';
      upgrade.depIndex = 0;
      upgrade.replaceString = script;
      reuseExistingBranch = true;
      const srcAlreadyUpdated = src.replace('7.1.0', '7.1.1');
      const res = await doAutoReplace(
        upgrade,
        srcAlreadyUpdated,
        reuseExistingBranch
      );
      expect(res).toEqual(srcAlreadyUpdated);
    });

    it('returns existing content if replaceString mismatch', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}   `;
      upgrade.baseDeps = extractPackageFile(src)?.deps;
      upgrade.depName = 'reactstrap';
      upgrade.packageName = 'reactstrap/7.1.0/reactstrap.min.js';
      upgrade.currentValue = '7.1.0';
      upgrade.newValue = '7.1.1';
      upgrade.depIndex = 0;
      upgrade.replaceString = script;
      const res = await doAutoReplace(
        upgrade,
        'wrong source',
        reuseExistingBranch
      );
      expect(res).toBe('wrong source');
    });

    it('updates version and integrity', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.10.0/katex.min.js" integrity="sha384-K3vbOmF2BtaVai+Qk37uypf7VrgBubhQreNQe9aGsz9lB63dIFiQVlJbr92dw2Lx" crossorigin="anonymous">';
      upgrade.baseDeps = extractPackageFile(script)?.deps;
      upgrade.depName = 'KaTeX';
      upgrade.packageName = 'KaTeX/0.10.0/katex.min.js';
      upgrade.currentValue = '0.10.0';
      upgrade.currentDigest =
        'sha384-K3vbOmF2BtaVai+Qk37uypf7VrgBubhQreNQe9aGsz9lB63dIFiQVlJbr92dw2Lx';
      upgrade.newValue = '0.11.1';
      upgrade.newDigest = 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      upgrade.depIndex = 0;
      upgrade.replaceString = script;
      const res = await doAutoReplace(upgrade, script, reuseExistingBranch);
      expect(res).toBe(
        `<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.11.1/katex.min.js" integrity="sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" crossorigin="anonymous">`
      );
    });

    it('updates with autoReplaceNewString', async () => {
      const dockerfile =
        'FROM node:8.11.3-alpine@sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d AS node';
      upgrade.manager = 'dockerfile';
      upgrade.depName = 'node';
      upgrade.packageName = 'node';
      upgrade.currentValue = '8.11.3-alpine';
      upgrade.newValue = '8.11.4-alpine';
      upgrade.currentDigest =
        'sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d';
      upgrade.newDigest = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      upgrade.depIndex = 0;
      upgrade.replaceString =
        'node:8.11.3-alpine@sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d';
      upgrade.autoReplaceStringTemplate =
        '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(
        `FROM node:8.11.4-alpine@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa AS node`
      );
    });

    it('fails with oldversion in depname', async () => {
      const yml =
        'image: "1111111111.dkr.ecr.us-east-1.amazonaws.com/my-repository:1"\n\n';
      upgrade.manager = 'regex';
      upgrade.depName =
        '1111111111.dkr.ecr.us-east-1.amazonaws.com/my-repository';
      upgrade.currentValue = '1';
      upgrade.newValue = '42';
      upgrade.depIndex = 0;
      upgrade.replaceString =
        'image: "1111111111.dkr.ecr.us-east-1.amazonaws.com/my-repository:1"\n\n';
      upgrade.packageFile = 'k8s/base/defaults.yaml';
      upgrade.matchStrings = [
        'image:\\s*\\\'?\\"?(?<depName>[^:]+):(?<currentValue>[^\\s\\\'\\"]+)\\\'?\\"?\\s*',
      ];
      const res = doAutoReplace(upgrade, yml, reuseExistingBranch);
      await expect(res).rejects.toThrow(WORKER_FILE_UPDATE_FAILED);
    });
  });
});
