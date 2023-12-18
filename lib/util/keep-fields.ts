export default function keepFields(
  obj: Record<string, any>,
  fieldsToKeep?: (string | RegExp)[],
): Record<string, any> {
  if (fieldsToKeep === undefined) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => {
      return fieldsToKeep.some((field) => {
        if (field instanceof RegExp) {
          return field.test(key);
        }
        return key === field;
      });
    }),
  );
}
