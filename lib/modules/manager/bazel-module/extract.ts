import type { PackageFileContent } from '../types';
import { BazelDepRecordToPackageDependency } from './bazel-dep';
import { instanceExists } from './filters';
import { RecordFragment } from './fragments';
import { parse } from './parser';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFileContent | null {
  const fragments = parse(content, packageFile);
  if (!fragments) {
    return null;
  }
  // DEBUG BEGIN
  const dbgMsgs = [];
  dbgMsgs.push('fragments: ', fragments, '\n');
  // DEBUG END
  const deps = fragments
    // DEBUG BEGIN
    .map((value) => {
      dbgMsgs.push('value: ', value, '\n');
      const isRecord = value instanceof RecordFragment;
      dbgMsgs.push('isRecord: ', isRecord, '\n');
      return value;
    })
    // DEBUG END
    .filter((value) => value instanceof RecordFragment)
    .map((value) => value as RecordFragment)
    // // DEBUG BEGIN
    // .map((record) => {
    //   dbgMsgs.push('record: ', record, '\n');
    //   return record;
    // })
    // // DEBUG END
    .filter((record) => record.isRule('bazel_dep'))
    // // DEBUG BEGIN
    // .map((record) => {
    //   dbgMsgs.push('record: ', record, '\n');
    //   return record;
    // })
    // // DEBUG END
    .map((record) => {
      const result = BazelDepRecordToPackageDependency.safeParse(record);
      // DEBUG BEGIN
      dbgMsgs.push('result: ', result, '\n');
      // DEBUG END
      return result.success ? result.data : undefined;
    })
    .filter(instanceExists);
  // // DEBUG BEGIN
  // console.log('*** CHUCK \n', ...dbgMsgs);
  // // DEBUG END
  return deps.length ? { deps } : null;
}
