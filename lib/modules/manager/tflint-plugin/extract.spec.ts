import { join } from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { extractPackageFile } from '.';

const configNormal = `
plugin "foo" {
  enabled = true
  version = "0.1.0"
  source  = "github.com/org/tflint-ruleset-foo"
}

plugin "bar" {
  enabled = true
  version = "1.42.0"
  source  = "github.com/org2/tflint-ruleset-bar"
}
`;

const configNoVersion = `
plugin "bundled" {}
`;

const configFull = `
config {
  format = "compact"
  plugin_dir = "~/.tflint.d/plugins"

  module = true
  force = false
  disabled_by_default = false

  ignore_module = {
    "terraform-aws-modules/vpc/aws"            = true
    "terraform-aws-modules/security-group/aws" = true
  }

  varfile = ["example1.tfvars", "example2.tfvars"]
}

plugin "aws" {
  enabled = true
  version = "0.4.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

rule "aws_instance_invalid_type" {
  enabled = false
}
`;

const noSource = `
plugin "aws" {
  enabled = true
  version = "0.4.0"
}

plugin "bundled" {
  # A bundled plugin, probably.
  enabled = true
}
`;

const notGithub = `
plugin "aws" {
  enabled = true
  version = "0.4.0"
  source  = "gitlab.com/terraform-linters/tflint-ruleset-aws"
}
`;

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

// auto-mock fs
jest.mock('../../../util/fs');

describe('modules/manager/tflint-plugin/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(
        extractPackageFile('nothing here', 'doesnt-exist.hcl', {})
      ).toBeNull();
    });

    it('returns null when there are no version', () => {
      expect(
        extractPackageFile(configNoVersion, 'doesnt-exist.hcl', {})
      ).toBeNull();
    });

    it('extracts plugins', () => {
      const res = extractPackageFile(configNormal, 'tflint-1.hcl', {});
      expect(res).toEqual({
        deps: [
          {
            currentValue: '0.1.0',
            datasource: 'github-releases',
            depType: 'plugin',
            depName: 'org/tflint-ruleset-foo',
          },
          {
            currentValue: '1.42.0',
            datasource: 'github-releases',
            depType: 'plugin',
            depName: 'org2/tflint-ruleset-bar',
          },
        ],
      });
    });

    it('extracts from full configuration', () => {
      const res = extractPackageFile(configFull, 'tflint-full.hcl', {});
      expect(res).toEqual({
        deps: [
          {
            currentValue: '0.4.0',
            datasource: 'github-releases',
            depType: 'plugin',
            depName: 'terraform-linters/tflint-ruleset-aws',
          },
        ],
      });
    });

    it('extracts no source', () => {
      const res = extractPackageFile(noSource, 'tflint-no-source.hcl', {});
      expect(res).toEqual({
        deps: [
          {
            skipReason: 'no-source',
          },
          {
            skipReason: 'no-source',
          },
        ],
      });
    });

    it('extracts nothing if not from github', () => {
      const res = extractPackageFile(notGithub, 'tflint-not-github.hcl', {});
      expect(res).toEqual({
        deps: [
          {
            depName: 'gitlab.com/terraform-linters/tflint-ruleset-aws',
            depType: 'plugin',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });
  });
});
