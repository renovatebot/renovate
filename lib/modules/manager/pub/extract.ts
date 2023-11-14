import is from '@sindresorhus/is';
import type { SkipReason } from '../../../types';
import { DartDatasource } from '../../datasource/dart';
import { DartVersionDatasource } from '../../datasource/dart-version';
import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import type { PackageDependency, PackageFileContent } from '../types';
import type { PubspecSchema } from './schema';
import { parsePubspec } from './utils';

function extractFromSection(
  pubspec: PubspecSchema,
  sectionKey: keyof Pick<PubspecSchema, 'dependencies' | 'dev_dependencies'>,
): PackageDependency[] {
  const sectionContent = pubspec[sectionKey];
  if (!sectionContent) {
    return [];
  }

  const skippedPackages = [
    'flutter_driver',
    'flutter_localizations',
    'flutter_test',
    'flutter_web_plugins',
    'meta',
  ];
  const deps: PackageDependency[] = [];
  for (const depName of Object.keys(sectionContent)) {
    if (skippedPackages.includes(depName)) {
      continue;
    }

    let currentValue = sectionContent[depName];
    let skipReason: SkipReason | undefined;

    if (!is.string(currentValue)) {
      const version = currentValue.version;
      const path = currentValue.path;
      if (version) {
        currentValue = version;
      } else if (path) {
        currentValue = '';
        skipReason = 'path-dependency';
      } else {
        currentValue = '';
      }
    }

    deps.push({
      depName,
      depType: sectionKey,
      currentValue,
      datasource: DartDatasource.id,
      skipReason,
    });
  }

  return deps;
}

function extractDart(pubspec: PubspecSchema): PackageDependency[] {
  return [
    {
      depName: 'dart',
      currentValue: pubspec.environment.sdk,
      datasource: DartVersionDatasource.id,
    },
  ];
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
  packageFile: string,
): PackageFileContent | null {
  const pubspec = parsePubspec(packageFile, content);
  if (!pubspec) {
    return null;
  }

  return {
    deps: [
      ...extractFromSection(pubspec, 'dependencies'),
      ...extractFromSection(pubspec, 'dev_dependencies'),
      ...extractDart(pubspec),
      ...extractFlutter(pubspec),
    ],
  };
}
