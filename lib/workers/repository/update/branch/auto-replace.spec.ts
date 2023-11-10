import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../../test/fixtures';
import { getConfig } from '../../../../config/defaults';
import { GlobalConfig } from '../../../../config/global';
import { WORKER_FILE_UPDATE_FAILED } from '../../../../constants/error-messages';
import { extractPackageFile } from '../../../../modules/manager/html';
import type { BranchUpgradeConfig } from '../../../types';
import { doAutoReplace } from './auto-replace';

const sampleHtml = Fixtures.get(
  'sample.html',
  `../../../../modules/manager/html`,
);

jest.mock('../../../../util/fs');

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
      // TODO: fix types (#22198)
      upgrade = getConfig() as BranchUpgradeConfig;
      upgrade.packageFile = 'test';
      upgrade.manager = 'html';
      reuseExistingBranch = false;
    });

    it('rebases if the deps list has changed', async () => {
      upgrade.baseDeps = extractPackageFile(sampleHtml)?.deps;
      reuseExistingBranch = true;
      const res = await doAutoReplace(
        upgrade,
        'existing content',
        reuseExistingBranch,
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

    // for coverage
    it('uses depName or packageName', async () => {
      upgrade.baseDeps = [
        {
          datasource: 'cdnjs',
          packageName: 'react-router/react-router-test.min.js',
          currentValue: '4.2.1',
          replaceString:
            '<script src=" https://cdnjs.cloudflare.com/ajax/libs/react-router/4.3.1/react-router.min.js">',
        },
        {
          datasource: 'cdnjs',
          depName: 'react-router-test',
          currentValue: '4.1.1',
          replaceString:
            '<script src=" https://cdnjs.cloudflare.com/ajax/libs/react-router/4.3.1/react-router.min.js">',
        },
      ];
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
        reuseExistingBranch,
      );
      expect(res).toEqual(srcAlreadyUpdated);
    });

    it('handles no work', async () => {
      const script =
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/reactstrap/7.1.0/reactstrap.min.js">';
      const src = `     ${script}   `;
      upgrade.baseDeps = extractPackageFile(src)?.deps;
      upgrade.depName = 'reactstrap';
      upgrade.packageName = 'reactstrap/7.1.0/reactstrap.min.js';
      upgrade.currentValue = '7.0.9';
      upgrade.newValue = '7.1.0';
      upgrade.depIndex = 0;
      upgrade.replaceString = script;
      reuseExistingBranch = false;
      const res = await doAutoReplace(upgrade, src, reuseExistingBranch, false);
      expect(res).toEqual(src);
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
        reuseExistingBranch,
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
        `<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.11.1/katex.min.js" integrity="sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" crossorigin="anonymous">`,
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
        `FROM node:8.11.4-alpine@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa AS node`,
      );
    });

    it('succeeds when using autoReplaceStringTemplate to update depName when using regex', async () => {
      const yml =
        "- project: 'pipeline-fragments/docker-test'\n" +
        'ref: 3-0-0\n' +
        "file: 'ci-include-docker-test-base.yml'\n" +
        "- project: 'pipeline-fragments/docker-lint'\n" +
        'ref: 2-4-0\n' +
        "file: 'ci-include-docker-lint-base.yml'";
      upgrade.manager = 'regex';
      upgrade.depName = 'pipeline-solutions/gitlab/fragments/docker-lint';
      upgrade.currentValue = '2-4-0';
      upgrade.newValue = '2-4-1';
      upgrade.depIndex = 0;
      upgrade.replaceString = "'pipeline-fragments/docker-lint'\nref: 2-4-0";
      upgrade.packageFile = '.gitlab-ci.yml';
      upgrade.autoReplaceStringTemplate =
        "'{{{depName}}}'\nref: {{{newValue}}}";
      upgrade.matchStringsStrategy = 'combination';

      // If the new "name" is not added to the matchStrings, the regex matcher fails to extract from `newContent` as
      // there's nothing defined in there anymore that it can match
      upgrade.matchStrings = [
        '[\'"]?(?<depName>pipeline-fragments\\/docker-lint)[\'"]?\\s*ref:\\s[\'"]?(?<currentValue>[\\d-]*)[\'"]?',
        '[\'"]?(?<depName>pipeline-solutions\\/gitlab\\/fragments\\/docker-lint)[\'"]?\\s*ref:\\s[\'"]?(?<currentValue>[\\d-]*)[\'"]?',
      ];
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        "- project: 'pipeline-fragments/docker-test'\n" +
          'ref: 3-0-0\n' +
          "file: 'ci-include-docker-test-base.yml'\n" +
          "- project: 'pipeline-solutions/gitlab/fragments/docker-lint'\n" +
          'ref: 2-4-1\n' +
          "file: 'ci-include-docker-lint-base.yml'",
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

    it('fails with digest mismatch', async () => {
      const dockerfile = codeBlock`
        FROM java:11@sha256-1234 as build
      `;
      upgrade.manager = 'dockerfile';
      upgrade.pinDigests = true;
      upgrade.depName = 'java';
      upgrade.currentValue = '11';
      upgrade.currentDigest = 'sha256-1234';
      upgrade.depIndex = 0;
      upgrade.newName = 'java';
      upgrade.newValue = '11';
      upgrade.newDigest = 'sha256-5678';
      upgrade.packageFile = 'Dockerfile';
      const res = doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      await expect(res).rejects.toThrow(WORKER_FILE_UPDATE_FAILED);
    });

    it('updates with docker replacement', async () => {
      const dockerfile = 'FROM bitnami/redis:6.0.8';
      upgrade.manager = 'dockerfile';
      upgrade.updateType = 'replacement';
      upgrade.depName = 'bitnami/redis';
      upgrade.newName = 'mcr.microsoft.com/oss/bitnami/redis';
      upgrade.replaceString = 'bitnami/redis:6.0.8';
      upgrade.packageFile = 'Dockerfile';
      upgrade.depIndex = 0;
      upgrade.currentValue = '6.0.8';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(dockerfile.replace(upgrade.depName, upgrade.newName));
    });

    it('handles already replaced', async () => {
      const dockerfile = 'FROM library/ubuntu:20.04';
      upgrade.manager = 'dockerfile';
      upgrade.updateType = 'replacement';
      upgrade.depName = 'library/alpine';
      upgrade.newName = 'library/ubuntu';
      upgrade.packageFile = 'Dockerfile';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(dockerfile);
    });

    it('handles replacement with depName===newName when replaceString exists', async () => {
      const yml =
        'image: "1111111111.dkr.ecr.us-east-1.amazonaws.com/my-repository:1"\n\n';
      upgrade.manager = 'regex';
      upgrade.updateType = 'replacement';
      upgrade.depName =
        '1111111111.dkr.ecr.us-east-1.amazonaws.com/my-repository';
      upgrade.currentValue = '1';
      upgrade.newName =
        '1111111111.dkr.ecr.us-east-1.amazonaws.com/my-repository';
      upgrade.depIndex = 0;
      upgrade.replaceString =
        'image: "1111111111.dkr.ecr.us-east-1.amazonaws.com/my-repository:1"\n\n';
      upgrade.packageFile = 'k8s/base/defaults.yaml';
      upgrade.matchStrings = [
        'image:\\s*\\\'?\\"?(?<depName>[^:]+):(?<currentValue>[^\\s\\\'\\"]+)\\\'?\\"?\\s*',
      ];
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(yml);
    });

    it('updates with terraform replacement', async () => {
      const hcl = codeBlock`
        module "foo" {
          source = "github.com/hashicorp/example?ref=v1.0.0"
        }
      `;
      upgrade.manager = 'terraform';
      upgrade.updateType = 'replacement';
      upgrade.depName = 'github.com/hashicorp/example';
      upgrade.newName = 'github.com/hashicorp/new-example';
      upgrade.currentValue = 'v1.0.0';
      upgrade.depIndex = 0;
      upgrade.packageFile = 'modules.tf';
      const res = await doAutoReplace(upgrade, hcl, reuseExistingBranch);
      expect(res).toBe(hcl.replace(upgrade.depName, upgrade.newName));
    });

    it('updates with ansible replacement', async () => {
      const yml = codeBlock`
        - name: Container present
          docker_container:
            name: mycontainer
            state: present
            image: ubuntu:14.04
            command: sleep infinity
      `;
      upgrade.manager = 'ansible';
      upgrade.depName = 'ubuntu';
      upgrade.currentValue = '14.04';
      upgrade.replaceString = 'ubuntu:14.04';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'tasks/main.yaml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with ansible-galaxy roles replacement', async () => {
      const yml = codeBlock`
        roles
          - name: geerlingguy.java
            version: 1.9.6
      `;
      upgrade.manager = 'ansible-galaxy';
      upgrade.depName = 'geerlingguy.java';
      upgrade.currentValue = '1.9.6';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'cloudalchemy.node_exporter';
      upgrade.newValue = '1.0.0';
      upgrade.packageFile = 'requirements.yaml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with azure-pipeline image replacement', async () => {
      const yml = codeBlock`
        resources:
          containers:
            - container: linux
              image: ubuntu:16.04
      `;
      upgrade.manager = 'azure-pipelines';
      upgrade.depName = 'ubuntu';
      upgrade.currentValue = '16.04';
      upgrade.replaceString = 'ubuntu:16.04';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'azure-pipeline.yml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with batect image replacement', async () => {
      const yml = codeBlock`
        containers:
          my-container:
            image: ubuntu:16.04
      `;
      upgrade.manager = 'batect';
      upgrade.depName = 'ubuntu';
      upgrade.currentValue = '16.04';
      upgrade.replaceString = 'ubuntu:16.04';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'batect.yml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with bitbucket-pipelines image replacement', async () => {
      const yml = 'image: ubuntu:16.04\n';
      upgrade.manager = 'bitbucket-pipelines';
      upgrade.depName = 'ubuntu';
      upgrade.currentValue = '16.04';
      upgrade.replaceString = 'ubuntu:16.04';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'bitbucket-pipelines.yml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with buildkite plugin replacement', async () => {
      const yml = codeBlock`
        steps:
          - command: test.sh
            plugins:
              - docker-compose#v3.10.0:
      `;
      upgrade.manager = 'buildkite';
      upgrade.depName = 'docker-compose';
      upgrade.currentValue = 'v3.10.0';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'buildpipe';
      upgrade.newValue = 'v0.10.1';
      upgrade.packageFile = 'buildkite.yml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with bundler gem replacement', async () => {
      const gemfile = codeBlock`
        source 'https://rubygems.org'

        gem 'rails', '~>7.0'
      `;
      upgrade.manager = 'bundler';
      upgrade.depName = 'rails';
      upgrade.currentValue = "'~>7.0'";
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'rack';
      upgrade.newValue = "'~>2.2'";
      upgrade.packageFile = 'Gemfile';
      const res = await doAutoReplace(upgrade, gemfile, reuseExistingBranch);
      expect(res).toBe(
        gemfile
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with cake #addin replacement', async () => {
      const build =
        '#addin nuget:?package=Microsoft.Extensions.Logging&version=7.0.0-preview.7.22375.6&prerelease\n';
      upgrade.manager = 'cake';
      upgrade.depName = 'Microsoft.Extensions.Logging';
      upgrade.currentValue = '7.0.0-preview.7.22375.6';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'Newtonsoft.Json';
      upgrade.newValue = '13.0.2-beta1';
      upgrade.packageFile = 'build.cake';
      const res = await doAutoReplace(upgrade, build, reuseExistingBranch);
      expect(res).toBe(
        build
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with cargo dependency replacement', async () => {
      const cargo = codeBlock`
        [dependencies]
        rand = "0.8.4"
      `;
      upgrade.manager = 'cargo';
      upgrade.depName = 'rand';
      upgrade.currentValue = '0.8.4';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'syn';
      upgrade.newValue = '1.0.99';
      upgrade.packageFile = 'Cargo.toml';
      const res = await doAutoReplace(upgrade, cargo, reuseExistingBranch);
      expect(res).toBe(
        cargo
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with cloudbuild replacement', async () => {
      const yml = codeBlock`
        steps:
        - name: gcr.io/cloud-builders/docker
        - name: ubuntu:16.04
      `;
      upgrade.manager = 'cloudbuild';
      upgrade.depName = 'ubuntu';
      upgrade.replaceString = 'ubuntu:16.04';
      upgrade.currentValue = '16.04';
      upgrade.depIndex = 1;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'cloudbuild.yml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with podfile pod replacement', async () => {
      const podfile = "pod 'GoogleAnalytics', '3.20.0'";
      upgrade.manager = 'cocoapods';
      upgrade.depName = 'GoogleAnalytics';
      upgrade.currentValue = '3.20.0';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'Docker';
      upgrade.newValue = '1.3.11';
      upgrade.packageFile = 'Podfile';
      const res = await doAutoReplace(upgrade, podfile, reuseExistingBranch);
      expect(res).toBe(
        podfile
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with composer require replacement', async () => {
      const json = codeBlock`
      {
          "require": {
                  "psr/log": "3.0.0"
          }
      }
      `;
      upgrade.manager = 'composer';
      upgrade.depName = 'psr/log';
      upgrade.currentValue = '3.0.0';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'symfony/console';
      upgrade.newValue = 'v6.1.3';
      upgrade.packageFile = 'composer.json';
      const res = await doAutoReplace(upgrade, json, reuseExistingBranch);
      expect(res).toBe(
        json
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with edn deps replacement', async () => {
      const edn = codeBlock`
      {:deps
        {com.taoensso/timbre {:mvn/version "5.2.1"}}
      }
      `;
      upgrade.manager = 'deps-edn';
      upgrade.depName = 'com.taoensso/timbre';
      upgrade.currentValue = '5.2.1';
      upgrade.depIndex = 0;
      upgrade.replaceString = '{:mvn/version \\"5.2.1\\"}';
      upgrade.updateType = 'replacement';
      upgrade.newName = 'org.clojure-android/tools.nrepl';
      upgrade.newValue = '0.2.6-lollipop';
      upgrade.packageFile = 'deps.edn';
      const res = await doAutoReplace(upgrade, edn, reuseExistingBranch);
      expect(res).toBe(
        edn
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with docker-compose image replacement', async () => {
      const yml = codeBlock`
        services:
          test:
            image: "ubuntu:16.04"
      `;
      upgrade.manager = 'docker-compose';
      upgrade.depName = 'ubuntu';
      upgrade.replaceString = 'ubuntu:16.04';
      upgrade.currentValue = '16.04';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'docker-compose.yml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with Dockerfile image replacement', async () => {
      const dockerfile = 'FROM ubuntu:16.04\n';
      upgrade.manager = 'dockerfile';
      upgrade.depName = 'ubuntu';
      upgrade.replaceString = 'ubuntu:16.04';
      upgrade.currentValue = '16.04';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'Dockerfile';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(
        dockerfile
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with Dockerfile image replacement with digest', async () => {
      const dockerfile = 'FROM ubuntu:16.04@q1w2e3r4t5z6u7i8o9p0\n';
      upgrade.manager = 'dockerfile';
      upgrade.depName = 'ubuntu';
      upgrade.replaceString = 'ubuntu:16.04@q1w2e3r4t5z6u7i8o9p0';
      upgrade.currentValue = '16.04';
      upgrade.currentDigest = 'q1w2e3r4t5z6u7i8o9p0';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.newDigest = 'p0o9i8u7z6t5r4e3w2q1';
      upgrade.packageFile = 'Dockerfile';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(
        dockerfile
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue)
          .replace(upgrade.currentDigest, upgrade.newDigest),
      );
    });

    it('updates with droneci image replacement', async () => {
      const yml = codeBlock`
        steps:
        - name: test
          image: ubuntu:16.04
      `;
      upgrade.manager = 'droneci';
      upgrade.depName = 'ubuntu';
      upgrade.replaceString = 'ubuntu:16.04';
      upgrade.currentValue = '16.04';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = '.drone.yml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with gitlabci image replacement', async () => {
      const yml = 'image: "ubuntu:16.04"\n';
      upgrade.manager = 'gitlabci';
      upgrade.depName = 'ubuntu';
      upgrade.replaceString = 'ubuntu:16.04';
      upgrade.currentValue = '16.04';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = '.gitlab-ci.yml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with helm value image/repository replacement', async () => {
      const yml = codeBlock`
        parser:
          image:
              repository: docker.io/securecodebox/parser-nmap
              tag: 3.14.3
      `;
      upgrade.manager = 'helm-values';
      upgrade.depName = 'docker.io/securecodebox/parser-nmap';
      upgrade.replaceString = '3.14.3';
      upgrade.currentValue = '3.14.3';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'iteratec/juice-balancer';
      upgrade.newValue = 'v5.1.0';
      upgrade.packageFile = 'values.yml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with jenkins plugin replacement', async () => {
      const txt = 'script-security:1175\n';
      upgrade.manager = 'jenkins';
      upgrade.depName = 'script-security';
      upgrade.currentValue = '1175';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'Mailer';
      upgrade.newValue = '438.v02c7f0a_12fa_4';
      upgrade.packageFile = 'plugins.txt';
      const res = await doAutoReplace(upgrade, txt, reuseExistingBranch);
      expect(res).toBe(
        txt
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with meteor npm.depends replacement', async () => {
      const js = codeBlock`
        Package.describe({
          'name': 'test',
        });

        Npm.depends({
          'xml2js': '0.2.0'
        });'
      `;
      upgrade.manager = 'meteor';
      upgrade.depName = 'xml2js';
      upgrade.currentValue = '0.2.0';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'connect';
      upgrade.newValue = '2.7.10';
      upgrade.packageFile = 'package.js';
      const res = await doAutoReplace(upgrade, js, reuseExistingBranch);
      expect(res).toBe(
        js
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('checks for replaceWithoutReplaceString double update', async () => {
      const js = codeBlock`
        Package.describe({
          'name': 'test',
        });

        Npm.depends({
          'xml2js': '0.2.0',
          'xml2js': '0.2.0'
        });
      `;
      upgrade.manager = 'meteor';
      upgrade.depName = 'xml2js';
      upgrade.currentValue = '0.2.0';
      upgrade.depIndex = 1;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'connect';
      upgrade.newValue = '2.7.10';
      upgrade.packageFile = 'package.js';
      const res = await doAutoReplace(upgrade, js, reuseExistingBranch);
      expect(res).toBe(
        codeBlock`
        Package.describe({
          'name': 'test',
        });

        Npm.depends({
          'xml2js': '0.2.0',
          'connect': '2.7.10'
        });
      `,
      );
    });

    it('updates with mix deps replacement', async () => {
      const exs = codeBlock`
        defmodule MyProject.MixProject do
          use Mix.Project

          def project() do
            [
              app: :my_project,
              version: "0.0.1",
              elixir: "~> 1.0",
              deps: deps(),
            ]
          end

          def application() do
            []
          end

          defp deps() do
            [
              {:postgrex, "~> 0.8.1"}
            ]
          end
        end
      `;
      upgrade.manager = 'mix';
      upgrade.depName = 'postgrex';
      upgrade.currentValue = '~> 0.8.1';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'jason';
      upgrade.newValue = '~> 1.3.0';
      upgrade.packageFile = 'mix.exs';
      const res = await doAutoReplace(upgrade, exs, reuseExistingBranch);
      expect(res).toBe(
        exs
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with nuget tools replacement', async () => {
      const json = codeBlock`
        {
          "version": 1,
          "isRoot": true,
          "tools": {
            "Microsoft.Extensions.Logging": {
              "version": "7.0.0-preview.7.22375.6"
            }
          }
        }
      `;
      upgrade.manager = 'nuget';
      upgrade.depName = 'Microsoft.Extensions.Logging';
      upgrade.currentValue = '7.0.0-preview.7.22375.6';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'Newtonsoft.Json';
      upgrade.newValue = '13.0.2-beta1';
      upgrade.packageFile = 'dotnet-tools.json';
      const res = await doAutoReplace(upgrade, json, reuseExistingBranch);
      expect(res).toBe(
        json
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with pre-commit repo replacement', async () => {
      const yml = codeBlock`
        repos:
        -   repo: https://github.com/pre-commit/pre-commit-hooks
            rev: v4.3.0
      `;
      upgrade.manager = 'pre-commit';
      upgrade.depName = 'pre-commit/pre-commit-hooks';
      upgrade.currentValue = 'v4.3.0';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'pre-commit/pygrep-hooks';
      upgrade.newValue = 'v1.9.0';
      upgrade.packageFile = '.pre-commit-config.yaml';
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        yml
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with terraform image replacement', async () => {
      const tf = codeBlock`
        resource "docker_image" "image" {
          name = "ubuntu:16.04"
        }
      `;
      upgrade.manager = 'terraform';
      upgrade.depName = 'ubuntu';
      upgrade.replaceString = 'ubuntu:16.04';
      upgrade.currentValue = '16.04';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'test.tf';
      const res = await doAutoReplace(upgrade, tf, reuseExistingBranch);
      expect(res).toBe(
        tf
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with terraform module replacement', async () => {
      const tf = codeBlock`
        module "vpc" {
          source  = "terraform-aws-modules/vpc/aws"
          version = "3.14.2"
        }
      `;
      upgrade.manager = 'terraform';
      upgrade.depName = 'terraform-aws-modules/vpc/aws';
      upgrade.currentValue = '3.14.2';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'cloudposse/label/null';
      upgrade.newValue = '0.25.0';
      upgrade.packageFile = 'module-test.tf';
      const res = await doAutoReplace(upgrade, tf, reuseExistingBranch);
      expect(res).toBe(
        tf
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with setup-cfg replacement', async () => {
      const tf = codeBlock`
        [options]
        install_requires = sphinx ~=5.1.0
      `;
      upgrade.manager = 'setup-cfg';
      upgrade.depName = 'sphinx';
      upgrade.currentValue = '~=5.1.0';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'postgres';
      upgrade.newValue = '~=4.0.0';
      upgrade.packageFile = 'setup.cfg';
      const res = await doAutoReplace(upgrade, tf, reuseExistingBranch);
      expect(res).toBe(
        tf
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with nvm version replacement', async () => {
      const tf = '12.3.4';
      upgrade.manager = 'nvm';
      upgrade.depName = 'node';
      upgrade.currentValue = '12.3.4';
      upgrade.depIndex = 0;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'node';
      upgrade.newValue = '16.5.4';
      upgrade.packageFile = '.nvmrc';
      const res = await doAutoReplace(upgrade, tf, reuseExistingBranch);
      expect(res).toBe(
        tf
          .replace(upgrade.depName, upgrade.newName)
          .replace(upgrade.currentValue, upgrade.newValue),
      );
    });

    it('updates with multiple same name replacement without replaceString', async () => {
      const dockerfile = codeBlock`
        FROM ubuntu:16.04
        FROM ubuntu:20.04
        FROM ubuntu:18.04
      `;
      upgrade.manager = 'dockerfile';
      upgrade.depName = 'ubuntu';
      upgrade.currentValue = '18.04';
      upgrade.depIndex = 2;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'Dockerfile';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(
        codeBlock`
          FROM ubuntu:16.04
          FROM ubuntu:20.04
          FROM alpine:3.16
        `,
      );
    });

    it('updates with multiple same name replacement without replaceString 2', async () => {
      const dockerfile = codeBlock`
        FROM ubuntu:16.04
        FROM ubuntu:20.04
        FROM ubuntu:18.04
      `;
      upgrade.manager = 'dockerfile';
      upgrade.depName = 'ubuntu';
      upgrade.currentValue = '20.04';
      upgrade.depIndex = 1;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'Dockerfile';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(
        codeBlock`
          FROM ubuntu:16.04
          FROM alpine:3.16
          FROM ubuntu:18.04
        `,
      );
    });

    it('updates with multiple same version replacement without replaceString', async () => {
      const dockerfile = codeBlock`
        FROM notUbuntu:18.04
        FROM alsoNotUbuntu:18.04
        FROM ubuntu:18.04
      `;
      upgrade.manager = 'dockerfile';
      upgrade.depName = 'ubuntu';
      upgrade.currentValue = '18.04';
      upgrade.depIndex = 2;
      upgrade.updateType = 'replacement';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.packageFile = 'Dockerfile';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(
        codeBlock`
          FROM notUbuntu:18.04
          FROM alsoNotUbuntu:18.04
          FROM alpine:3.16
        `,
      );
    });

    it('docker: updates with pinDigest enabled but no currentDigest value', async () => {
      const dockerfile = codeBlock`
        FROM ubuntu:18.04
      `;
      upgrade.manager = 'dockerfile';
      upgrade.updateType = 'replacement';
      upgrade.pinDigests = true;
      upgrade.depName = 'ubuntu';
      upgrade.currentValue = '18.04';
      upgrade.currentDigest = undefined;
      upgrade.depIndex = 0;
      upgrade.replaceString = 'ubuntu:18.04';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.newDigest = 'sha256:p0o9i8u7z6t5r4e3w2q1';
      upgrade.packageFile = 'Dockerfile';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(
        codeBlock`
          FROM alpine:3.16
        `,
      );
    });

    it('docker: updates with pinDigest enabled and a currentDigest value', async () => {
      const dockerfile = codeBlock`
        FROM ubuntu:18.04@sha256:q1w2e3r4t5z6u7i8o9p0
      `;
      upgrade.manager = 'dockerfile';
      upgrade.updateType = 'replacement';
      upgrade.pinDigests = true;
      upgrade.depName = 'ubuntu';
      upgrade.currentValue = '18.04';
      upgrade.currentDigest = 'sha256:q1w2e3r4t5z6u7i8o9p0';
      upgrade.depIndex = 0;
      upgrade.replaceString = 'ubuntu:18.04@sha256:q1w2e3r4t5z6u7i8o9p0';
      upgrade.newName = 'alpine';
      upgrade.newValue = '3.16';
      upgrade.newDigest = 'sha256:p0o9i8u7z6t5r4e3w2q1';
      upgrade.packageFile = 'Dockerfile';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(
        codeBlock`
          FROM alpine:3.16@sha256:p0o9i8u7z6t5r4e3w2q1
        `,
      );
    });

    it('autoReplaceGlobalMatch: throws error when globally replacing recurring values across version and digests', async () => {
      const dockerfile = codeBlock`
        FROM java:6@sha256:q1w2e3r4t5z6u7i8o9p0
      `;
      upgrade.manager = 'dockerfile';
      upgrade.depName = 'java';
      upgrade.currentValue = '6';
      upgrade.currentDigest = 'sha256:q1w2e3r4t5z6u7i8o9p0';
      upgrade.depIndex = 0;
      upgrade.pinDigests = true;
      upgrade.updateType = 'replacement';
      upgrade.replaceString = 'java:6@sha256:q1w2e3r4t5z6u7i8o9p0';
      upgrade.newName = 'eclipse-temurin';
      upgrade.newValue = '11';
      upgrade.newDigest = 'sha256:p0o9i8u7z6t5r4e3w2q1';
      upgrade.packageFile = 'Dockerfile';
      const res = doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      await expect(res).rejects.toThrow(WORKER_FILE_UPDATE_FAILED);
    });

    it('autoReplaceGlobalMatch: updates when replacing first match only of recurring values across version and digests', async () => {
      const dockerfile = codeBlock`
        FROM java:6@sha256:q1w2e3r4t5z6u7i8o9p0
      `;
      upgrade.autoReplaceGlobalMatch = false;
      upgrade.manager = 'dockerfile';
      upgrade.depName = 'java';
      upgrade.currentValue = '6';
      upgrade.currentDigest = 'sha256:q1w2e3r4t5z6u7i8o9p0';
      upgrade.depIndex = 0;
      upgrade.pinDigests = true;
      upgrade.updateType = 'replacement';
      upgrade.replaceString = 'java:6@sha256:q1w2e3r4t5z6u7i8o9p0';
      upgrade.newName = 'eclipse-temurin';
      upgrade.newValue = '11';
      upgrade.newDigest = 'sha256:p0o9i8u7z6t5r4e3w2q1';
      upgrade.packageFile = 'Dockerfile';
      const res = await doAutoReplace(upgrade, dockerfile, reuseExistingBranch);
      expect(res).toBe(
        codeBlock`
          FROM eclipse-temurin:11@sha256:p0o9i8u7z6t5r4e3w2q1
        `,
      );
    });

    it('regex: updates with pinDigest enabled but no currentDigest value', async () => {
      const yml = 'image: "some.url.com/my-repository:1.0"';
      upgrade.manager = 'regex';
      upgrade.updateType = 'replacement';
      upgrade.pinDigests = true;
      upgrade.depName = 'some.url.com/my-repository';
      upgrade.currentValue = '1.0';
      upgrade.currentDigest = undefined;
      upgrade.depIndex = 0;
      upgrade.replaceString = 'image: "some.url.com/my-repository:1.0"';
      upgrade.packageFile = 'k8s/base/defaults.yaml';
      upgrade.newName = 'some.other.url.com/some-new-repo';
      upgrade.newValue = '3.16';
      upgrade.newDigest = 'sha256:p0o9i8u7z6t5r4e3w2q1';
      upgrade.matchStrings = [
        'image:\\s*?\\\'?\\"?(?<depName>[^:\\\'\\"]+):(?<currentValue>[^@\\\'\\"]+)@?(?<currentDigest>[^\\s\\\'\\"]+)?\\"?\\\'?\\s*',
      ];
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe('image: "some.other.url.com/some-new-repo:3.16"');
    });

    it('regex: updates with pinDigest enabled and a currentDigest value', async () => {
      const yml =
        'image: "some.url.com/my-repository:1.0@sha256:q1w2e3r4t5z6u7i8o9p0"';
      upgrade.manager = 'regex';
      upgrade.updateType = 'replacement';
      upgrade.pinDigests = true;
      upgrade.depName = 'some.url.com/my-repository';
      upgrade.currentValue = '1.0';
      upgrade.currentDigest = 'sha256:q1w2e3r4t5z6u7i8o9p0';
      upgrade.depIndex = 0;
      upgrade.replaceString =
        'image: "some.url.com/my-repository:1.0@sha256:q1w2e3r4t5z6u7i8o9p0"';
      upgrade.packageFile = 'k8s/base/defaults.yaml';
      upgrade.newName = 'some.other.url.com/some-new-repo';
      upgrade.newValue = '3.16';
      upgrade.newDigest = 'sha256:p0o9i8u7z6t5r4e3w2q1';
      upgrade.matchStrings = [
        'image:\\s*[\\\'\\"]?(?<depName>[^:]+):(?<currentValue>[^@]+)?@?(?<currentDigest>[^\\s\\\'\\"]+)?[\\\'\\"]?\\s*',
      ];
      const res = await doAutoReplace(upgrade, yml, reuseExistingBranch);
      expect(res).toBe(
        'image: "some.other.url.com/some-new-repo:3.16@sha256:p0o9i8u7z6t5r4e3w2q1"',
      );
    });

    it('github-actions: updates with newValue only', async () => {
      const githubAction = codeBlock`
        jobs:
          build:
            runs-on: ubuntu-latest
            steps:
              - uses: actions/checkout@v1.0.0
      `;
      upgrade.manager = 'github-actions';
      upgrade.updateType = 'replacement';
      upgrade.autoReplaceStringTemplate =
        '{{depName}}@{{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}{{/unless}}';
      upgrade.depName = 'actions/checkout';
      upgrade.currentValue = 'v1.0.0';
      upgrade.currentDigest = undefined;
      upgrade.currentDigestShort = undefined;
      upgrade.depIndex = 0;
      upgrade.replaceString = 'actions/checkout@v1.0.0';
      upgrade.newValue = 'v2.0.0';
      upgrade.newDigest = undefined;
      upgrade.packageFile = 'workflows/build.yml';
      const res = await doAutoReplace(
        upgrade,
        githubAction,
        reuseExistingBranch,
      );
      expect(res).toBe(
        codeBlock`
          jobs:
            build:
              runs-on: ubuntu-latest
              steps:
                - uses: actions/checkout@v2.0.0
        `,
      );
    });

    it('github-actions: updates with newValue and newDigest', async () => {
      const githubAction = codeBlock`
        jobs:
          build:
            runs-on: ubuntu-latest
            steps:
              - uses: actions/checkout@v1.0.0
      `;
      upgrade.manager = 'github-actions';
      upgrade.updateType = 'replacement';
      upgrade.autoReplaceStringTemplate =
        '{{depName}}@{{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}{{/unless}}';
      upgrade.depName = 'actions/checkout';
      upgrade.currentValue = 'v1.0.0';
      upgrade.currentDigest = undefined;
      upgrade.currentDigestShort = undefined;
      upgrade.depIndex = 0;
      upgrade.replaceString = 'actions/checkout@v1.0.0';
      upgrade.newValue = 'v2.0.0';
      upgrade.newDigest = '1cf887';
      upgrade.packageFile = 'workflows/build.yml';
      const res = await doAutoReplace(
        upgrade,
        githubAction,
        reuseExistingBranch,
      );
      expect(res).toBe(
        codeBlock`
          jobs:
            build:
              runs-on: ubuntu-latest
              steps:
                - uses: actions/checkout@1cf887 # v2.0.0
        `,
      );
    });

    it('github-actions: updates with pinDigest enabled but no currentDigest value', async () => {
      const githubAction = codeBlock`
        jobs:
          build:
            runs-on: ubuntu-latest
            steps:
              - uses: actions/checkout@v1.0.0
      `;
      upgrade.manager = 'github-actions';
      upgrade.updateType = 'replacement';
      upgrade.pinDigests = true;
      upgrade.autoReplaceStringTemplate =
        '{{depName}}@{{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}{{/unless}}';
      upgrade.depName = 'actions/checkout';
      upgrade.currentValue = 'v1.0.0';
      upgrade.currentDigest = undefined;
      upgrade.currentDigestShort = undefined;
      upgrade.depIndex = 0;
      upgrade.replaceString = 'actions/checkout@v1.0.0';
      upgrade.newName = 'some-other-action/checkout';
      upgrade.newValue = 'v2.0.0';
      upgrade.newDigest = '1cf887';
      upgrade.packageFile = 'workflows/build.yml';
      const res = await doAutoReplace(
        upgrade,
        githubAction,
        reuseExistingBranch,
      );
      expect(res).toBe(
        codeBlock`
          jobs:
            build:
              runs-on: ubuntu-latest
              steps:
                - uses: some-other-action/checkout@v2.0.0
        `,
      );
    });

    it('github-actions: updates with pinDigest enabled and a currentDigest value', async () => {
      const githubAction = codeBlock`
        jobs:
          build:
            runs-on: ubuntu-latest
            steps:
              - uses: actions/checkout@2485f4 # tag=v1.0.0
      `;
      upgrade.manager = 'github-actions';
      upgrade.updateType = 'replacement';
      upgrade.pinDigests = true;
      upgrade.autoReplaceStringTemplate =
        '{{depName}}@{{#if newDigest}}{{newDigest}}{{#if newValue}} # {{newValue}}{{/if}}{{/if}}{{#unless newDigest}}{{newValue}}{{/unless}}';
      upgrade.depName = 'actions/checkout';
      upgrade.currentValue = 'v1.0.0';
      upgrade.currentDigestShort = '2485f4';
      upgrade.depIndex = 0;
      upgrade.replaceString = 'actions/checkout@2485f4 # tag=v1.0.0';
      upgrade.newName = 'some-other-action/checkout';
      upgrade.newValue = 'v2.0.0';
      upgrade.newDigest = '1cf887';
      upgrade.packageFile = 'workflow.yml';
      const res = await doAutoReplace(
        upgrade,
        githubAction,
        reuseExistingBranch,
      );
      expect(res).toBe(
        codeBlock`
          jobs:
            build:
              runs-on: ubuntu-latest
              steps:
                - uses: some-other-action/checkout@1cf887 # tag=v2.0.0
        `,
      );
    });
  });
});
