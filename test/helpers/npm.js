const chai = require('chai');
const fs = require('fs');
const npm = require('../../lib/helpers/npm');

const defaultTypes = ['dependencies', 'devDependencies'];

chai.should();

const input01Content = fs.readFileSync('./test/_fixtures/package.json/inputs/01.json', 'utf8');
const input02Content = fs.readFileSync('./test/_fixtures/package.json/inputs/02.json', 'utf8');

describe('helpers/npm', () => {
  describe('.extractDependencies(packageJson, sections)', () => {
    it('returns an array of correct length', () => {
      const extractedDependencies =
        npm.extractDependencies(JSON.parse(input01Content), defaultTypes);
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(10);
    });
    it('each element contains non-null depType, depName, currentVersion', () => {
      const extractedDependencies =
        npm.extractDependencies(JSON.parse(input01Content), defaultTypes);
      extractedDependencies.every(dep => dep.depType && dep.depName && dep.currentVersion)
        .should.eql(true);
    });
    it('supports null devDependencies', () => {
      const extractedDependencies =
        npm.extractDependencies(JSON.parse(input02Content), defaultTypes);
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(6);
    });
  });
  describe('.getUpgrades(depName, currentVersion, versions)', () => {
    const testVersions = ['0.1.0', '1.0.0', '1.0.1', '1.1.0', '2.0.0-alpha1', '2.0.0', '2.0.1', '3.0.0', '3.1.0'];
    it('return empty if invalid current version', () => {
      npm.getUpgrades('foo', 'invalid', ['1.0.0', '1.0.1']).should.have.length(0);
    });
    it('return empty if no versions', () => {
      npm.getUpgrades('foo', '1.0.0', null).should.have.length(0);
    });
    it('supports minor and major upgrades, including for ranges', () => {
      const upgradeVersions = [
        {
          newVersion: '1.1.0',
          newVersionMajor: 1,
          upgradeType: 'minor',
          workingVersion: '1.0.1',
        },
        {
          newVersion: '2.0.1',
          newVersionMajor: 2,
          upgradeType: 'major',
          workingVersion: '1.0.1',
        },
        {
          newVersion: '3.1.0',
          newVersionMajor: 3,
          upgradeType: 'major',
          workingVersion: '1.0.1',
        },
      ];
      npm.getUpgrades('foo', '1.0.1', testVersions).should.eql(upgradeVersions);
      npm.getUpgrades('foo', '~1.0.1', testVersions).should.eql(upgradeVersions);
    });
    it('supports pinning', () => {
      const upgradeVersions = [
        {
          newVersion: '3.1.0',
          newVersionMajor: 3,
          upgradeType: 'pin',
        },
      ];
      npm.getUpgrades('foo', '^3.0.0', testVersions).should.eql(upgradeVersions);
    });
  });
  describe('.isRange(input)', () => {
    it('rejects simple semver', () => {
      npm.isRange('1.2.3').should.eql(false);
    });
    it('accepts tilde', () => {
      npm.isRange('~1.2.3').should.eql(true);
    });
    it('accepts caret', () => {
      npm.isRange('^1.2.3').should.eql(true);
    });
  });
  describe('.isValidVersion(input)', () => {
    it('should support simple semver', () => {
      npm.isValidVersion('1.2.3').should.eql(true);
    });
    it('should support versions with dash', () => {
      npm.isValidVersion('1.2.3-foo').should.eql(true);
    });
    it('should reject versions without dash', () => {
      npm.isValidVersion('1.2.3foo').should.eql(false);
    });
    it('should support ranges', () => {
      npm.isValidVersion('~1.2.3').should.eql(true);
      npm.isValidVersion('^1.2.3').should.eql(true);
      npm.isValidVersion('>1.2.3').should.eql(true);
    });
    it('should reject github repositories', () => {
      npm.isValidVersion('singapore/renovate').should.eql(false);
      npm.isValidVersion('singapore/renovate#master').should.eql(false);
      npm.isValidVersion('https://github.com/singapore/renovate.git').should.eql(false);
    });
  });
});
