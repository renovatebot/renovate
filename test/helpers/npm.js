const chai = require('chai');
const fs = require('fs');
const npm = require('../../app/helpers/npm');
const winston = require('winston');

chai.should();

npm.setLogger(winston);

const inputContent = fs.readFileSync('./test/_fixtures/package.json/inputs/01.json', 'utf8');

describe('npm helper', () => {
  describe('extractDependencies', () => {
    const extractedDependencies = npm.extractDependencies(JSON.parse(inputContent));
    it('returns an array of correct length', () => {
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(10);
    });
    it('each element contains non-null depType, depName, currentVersion', () => {
      extractedDependencies.every(dep => dep.depType && dep.depName && dep.currentVersion)
        .should.eql(true);
    });
  });
  describe('isRange', () => {
    it('should reject simple semver', () => {
      npm.isRange('1.2.3').should.eql(false);
    });
    it('should support tilde', () => {
      npm.isRange('~1.2.3').should.eql(true);
    });
    it('should support caret', () => {
      npm.isRange('^1.2.3').should.eql(true);
    });
  });
  describe('isValidVersion', () => {
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
