import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { defaultConfig, getName } from '../../../test/util';
import { WORKER_FILE_UPDATE_FAILED } from '../../constants/error-messages';
import { extractPackageFile } from '../../manager/html';
import type { BranchUpgradeConfig } from '../types';
import { doAutoReplace } from './auto-replace';

const sampleHtml = readFileSync(
  resolve(__dirname, `../../manager/html/__fixtures__/sample.html`),
  'utf8'
);

jest.mock('../../util/fs');

describe(getName(__filename), () => {
  describe('doAutoReplace', () => {
    let reuseExistingBranch: boolean;
    let upgrade: BranchUpgradeConfig;
    beforeEach(() => {
      upgrade = {
        ...JSON.parse(JSON.stringify(defaultConfig)),
        manager: 'html',
      };
      reuseExistingBranch = false;
    });
    it('rebases if the deps list has changed', async () => {
      upgrade.baseDeps = extractPackageFile(sampleHtml).deps;
      reuseExistingBranch = true;
      const res = await doAutoReplace(
        upgrade,
        'existing content',
        reuseExistingBranch
      );
      expect(res).toBeNull();
    });
    it('rebases if the deps to update has changed', async () => {
      upgrade.baseDeps = extractPackageFile(sampleHtml).deps;
      upgrade.baseDeps[0].currentValue = '1.0.0';
      reuseExistingBranch = true;
      const res = await doAutoReplace(upgrade, sampleHtml, reuseExistingBranch);
      expect(res).toBeNull();
    });
    it('updates version only', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}   `;
      upgrade.baseDeps = extractPackageFile(src).deps;
      upgrade.depName = 'reactstrap';
      upgrade.lookupName = 'reactstrap/7.1.0/reactstrap.min.js';
      upgrade.currentValue = '7.1.0';
      upgrade.newValue = '7.1.1';
      upgrade.newDigest = 'some-digest';
      upgrade.depIndex = 0;
      const res = await doAutoReplace(upgrade, src, reuseExistingBranch);
      expect(res).toMatchSnapshot();
    });
    it('handles a double attempt', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}  ${script} `;
      upgrade.baseDeps = extractPackageFile(src).deps;
      upgrade.depName = 'reactstrap';
      upgrade.lookupName = 'reactstrap/7.1.0/reactstrap.min.js';
      upgrade.currentValue = '7.1.0';
      upgrade.newValue = '7.1.1';
      upgrade.depIndex = 1;
      const res = await doAutoReplace(upgrade, src, reuseExistingBranch);
      expect(res).toMatchSnapshot();
    });
    it('handles already updated', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}   `;
      upgrade.baseDeps = extractPackageFile(src).deps;
      upgrade.depName = 'reactstrap';
      upgrade.lookupName = 'reactstrap/7.1.0/reactstrap.min.js';
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
      expect(res).toMatchSnapshot();
    });
    it('returns existing content if replaceString mismatch', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}   `;
      upgrade.baseDeps = extractPackageFile(src).deps;
      upgrade.depName = 'reactstrap';
      upgrade.lookupName = 'reactstrap/7.1.0/reactstrap.min.js';
      upgrade.currentValue = '7.1.0';
      upgrade.newValue = '7.1.1';
      upgrade.depIndex = 0;
      upgrade.replaceString = script;
      const res = await doAutoReplace(
        upgrade,
        'wrong source',
        reuseExistingBranch
      );
      expect(res).toEqual('wrong source');
    });
    it('updates version and integrity', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.10.0/katex.min.js" integrity="sha384-K3vbOmF2BtaVai+Qk37uypf7VrgBubhQreNQe9aGsz9lB63dIFiQVlJbr92dw2Lx" crossorigin="anonymous">';
      const src = `     ${script}   `;
      upgrade.baseDeps = extractPackageFile(src).deps;
      upgrade.depName = 'KaTeX';
      upgrade.lookupName = 'KaTeX/0.10.0/katex.min.js';
      upgrade.currentValue = '0.10.0';
      upgrade.currentDigest =
        'sha384-K3vbOmF2BtaVai+Qk37uypf7VrgBubhQreNQe9aGsz9lB63dIFiQVlJbr92dw2Lx';
      upgrade.newValue = '0.11.1';
      upgrade.newDigest = 'sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      upgrade.depIndex = 0;
      upgrade.replaceString = script;
      const res = await doAutoReplace(upgrade, src, reuseExistingBranch);
      expect(res).toMatchSnapshot();
    });
    it('updates with autoReplaceNewString', async () => {
      const dockerfile =
        'FROM node:8.11.3-alpine@sha256:d743b4141b02fcfb8beb68f92b4cd164f60ee457bf2d053f36785bf86de16b0d AS node';
      upgrade.manager = 'dockerfile';
      upgrade.depName = 'node';
      upgrade.lookupName = 'node';
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
      expect(res).toMatchSnapshot();
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
