import { AdoptiumJavaDatasource } from '../../datasource/adoptium-java';
import { DockerDatasource } from '../../datasource/docker';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HexpmBobDatasource } from '../../datasource/hexpm-bob';
import { NodeDatasource } from '../../datasource/node';
import { RubyVersionDatasource } from '../../datasource/ruby-version';

export { extractPackageFile } from './extract';

export const displayName = 'asdf';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.tool-versions$'],
};

export const supportedDatasources = [
  AdoptiumJavaDatasource.id,
  DockerDatasource.id,
  GithubReleasesDatasource.id,
  GithubTagsDatasource.id,
  HexpmBobDatasource.id,
  NodeDatasource.id,
  RubyVersionDatasource.id,
];
