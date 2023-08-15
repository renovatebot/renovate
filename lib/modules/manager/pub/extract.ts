import is from '@sindresorhus/is';
import { DartDatasource } from '../../datasource/dart';
import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import type { PackageDependency, PackageFileContent } from '../types';
import type { PubspecSchema } from './schema';
import { parsePubspec } from './utils';

function extractFromSection(
  pubspec: PubspecSchema,
  sectionKey: keyof Pick<PubspecSchema, 'dependencies' | 'dev_dependencies'>
): PackageDependency[] {
  const sectionContent = pubspec[sectionKey];
  if (!sectionContent) {
    return [];
  }

  const datasource = DartDatasource.id;
  const deps: PackageDependency[] = [];
  for (const depName of Object.keys(sectionContent)) {
    if (depName === 'meta') {
      continue;
    }

    let currentValue = sectionContent[depName];
    if (!is.string(currentValue)) {
      const version = currentValue.version;
      if (version) {
        currentValue = version;
      } else {
        currentValue = '';
      }
    }

    deps.push({ depName, depType: sectionKey, currentValue, datasource });
  }

  return deps;
}

function extractFlutter(pubspec: PubspecSchema): PackageDependency[] {
  const currentValue = pubspec.environment.flutter;
  if (!currentValue) {
    return [];
  }

  return [
    {
      depName: 'flutter',
      currentValue,
      datasource: FlutterVersionDatasource.id,
    },
  ];
}

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFileContent | null {
  const pubspec = parsePubspec(packageFile, content);
  if (!pubspec) {
    return null;
  }

  const deps = [
    ...extractFromSection(pubspec, 'dependencies'),
    ...extractFromSection(pubspec, 'dev_dependencies'),
    ...extractFlutter(pubspec),
  ];

  if (deps.length) {
    return { deps };
  }
  return null;
}
