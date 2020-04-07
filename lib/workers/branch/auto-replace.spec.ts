import { readFileSync } from 'fs';
import { resolve } from 'path';
import { doAutoReplace } from './auto-replace';
import { defaultConfig } from '../../../test/util';
import { extractPackageFile } from '../../manager/html';
import { BranchUpgradeConfig } from '../common';

const sampleHtml = readFileSync(
  resolve(__dirname, `../../manager/html/__fixtures__/sample.html`),
  'utf8'
);

describe('workers/branch/auto-replace', () => {
  describe('doAutoReplace', () => {
    let parentBranch: string;
    let upgrade: BranchUpgradeConfig;
    beforeEach(() => {
      upgrade = {
        ...JSON.parse(JSON.stringify(defaultConfig)),
        manager: 'html',
      };
      parentBranch = undefined;
    });
    it('rebases if the deps list has changed', async () => {
      upgrade.baseDeps = extractPackageFile(sampleHtml).deps;
      parentBranch = 'some existing branch';
      const res = await doAutoReplace(
        upgrade,
        'existing content',
        parentBranch
      );
      expect(res).toBeNull();
    });
    it('rebases if the deps to update has changed', async () => {
      upgrade.baseDeps = extractPackageFile(sampleHtml).deps;
      upgrade.baseDeps[0].currentValue = '1.0.0';
      parentBranch = 'some existing branch';
      const res = await doAutoReplace(upgrade, sampleHtml, parentBranch);
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
      upgrade.autoReplaceData = {
        depIndex: 0,
        replaceString: undefined,
      };
      const res = await doAutoReplace(upgrade, src, parentBranch);
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
      upgrade.autoReplaceData = {
        depIndex: 0,
        replaceString: script,
      };
      parentBranch = 'something';
      const srcAlreadyUpdated = src.replace('7.1.0', '7.1.1');
      const res = await doAutoReplace(upgrade, srcAlreadyUpdated, parentBranch);
      expect(res).toMatchSnapshot();
    });
    it('throws if replaceString mismatch', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}   `;
      upgrade.baseDeps = extractPackageFile(src).deps;
      upgrade.depName = 'reactstrap';
      upgrade.lookupName = 'reactstrap/7.1.0/reactstrap.min.js';
      upgrade.currentValue = '7.1.0';
      upgrade.newValue = '7.1.1';
      upgrade.autoReplaceData = {
        depIndex: 0,
        replaceString: script,
      };
      await expect(
        doAutoReplace(upgrade, 'wrong source', parentBranch)
      ).rejects.toThrow();
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
      upgrade.autoReplaceData = {
        depIndex: 0,
        replaceString: script,
      };
      const res = await doAutoReplace(upgrade, src, parentBranch);
      expect(res).toMatchSnapshot();
    });
  });
});
