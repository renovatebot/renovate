import { DartVersionDatasource } from '../../datasource/dart-version/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { DotnetVersionDatasource } from '../../datasource/dotnet-version/index.ts';
import { FlutterVersionDatasource } from '../../datasource/flutter-version/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { HexpmBobDatasource } from '../../datasource/hexpm-bob/index.ts';
import { JavaVersionDatasource } from '../../datasource/java-version/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'asdf';
export const url = 'https://asdf-vm.com';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.tool-versions$/'],
};

export const supportedDatasources = [
  DartVersionDatasource.id,
  DockerDatasource.id,
  DotnetVersionDatasource.id,
  FlutterVersionDatasource.id,
  GithubReleasesDatasource.id,
  GithubTagsDatasource.id,
  HexpmBobDatasource.id,
  JavaVersionDatasource.id,
  NodeVersionDatasource.id,
  NpmDatasource.id,
  PypiDatasource.id,
  RubyVersionDatasource.id,
];
