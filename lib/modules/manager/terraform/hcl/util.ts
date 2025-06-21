// take a JS value and return valid HCL literal
function toHclLiteral(value: any): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const elems = value.map((v) => toHclLiteral(v)).join(', ');
    return `[ ${elems} ]`;
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    let out = '{\n';
    for (const [k, v] of Object.entries(value)) {
      out += `  ${k} = ${toHclLiteral(v)}\n`;
    }
    out += '}';
    return out;
  }
  return `"${String(value)}"`;
}

// Safely normalize a block that might be either an array or a single object
function ensureArray<T>(maybeArray: T | T[] | undefined): T[] {
  if (Array.isArray(maybeArray)) {
    return maybeArray;
  }
  if (maybeArray === undefined || maybeArray === null) {
    return [];
  }
  return [maybeArray];
}

export function terraformJsonToHcl(terraformJson: any): string {
  let hcl = '';

  // 1) "module" blocks:
  if (terraformJson.module && typeof terraformJson.module === 'object') {
    for (const [modName, modValue] of Object.entries(
      terraformJson.module as Record<string, any>,
    )) {
      const modDefs = ensureArray(modValue);
      for (const modObj of modDefs) {
        hcl += `module "${modName}" {\n`;
        for (const [attr, val] of Object.entries(
          modObj as Record<string, any>,
        )) {
          hcl += `  ${attr} = ${toHclLiteral(val)}\n`;
        }
        hcl += `}\n\n`;
      }
    }
  }

  // 2) "resource" blocks:
  if (terraformJson.resource && typeof terraformJson.resource === 'object') {
    for (const [rtype, rinstances] of Object.entries(
      terraformJson.resource as Record<string, any>,
    )) {
      if (typeof rinstances === 'object') {
        for (const [rname, rawDef] of Object.entries(
          rinstances as Record<string, any>,
        )) {
          const rblocks = ensureArray(rawDef);
          for (const rblock of rblocks) {
            hcl += `resource "${rtype}" "${rname}" {\n`;
            for (const [attr, val] of Object.entries(
              rblock as Record<string, any>,
            )) {
              if (
                Array.isArray(val) &&
                val.every((x) => typeof x === 'object')
              ) {
                for (const nestedObj of val as Record<string, any>[]) {
                  hcl += `  ${attr} {\n`;
                  for (const [nestedKey, nestedVal] of Object.entries(
                    nestedObj,
                  )) {
                    hcl += `    ${nestedKey} = ${toHclLiteral(nestedVal)}\n`;
                  }
                  hcl += `  }\n`;
                }
              } else {
                hcl += `  ${attr} = ${toHclLiteral(val)}\n`;
              }
            }
            hcl += `}\n\n`;
          }
        }
      }
    }
  }

  // 3) "terraform" -> "required_providers":
  // terraformJson.terraform may be an array or single object
  const tfBlocks = ensureArray(terraformJson.terraform);
  for (const tfBlock of tfBlocks) {
    if (tfBlock && typeof tfBlock === 'object') {
      if (tfBlock.required_providers || tfBlock.required_version) {
        hcl += 'terraform {\n';
      }
      if (tfBlock.required_providers) {
        hcl += `  required_providers {\n`;
        for (const [provName, provAttrs] of Object.entries(
          tfBlock.required_providers as Record<string, any>,
        )) {
          if (typeof provAttrs === 'string') {
            hcl += `    ${provName} = "${provAttrs}"\n`;
          } else {
            hcl += `    ${provName} = {\n`;
            for (const [attr, val] of Object.entries(
              provAttrs as Record<string, any>,
            )) {
              hcl += `      ${attr} = ${toHclLiteral(val)}\n`;
            }
            hcl += `    }\n`;
          }
        }
        hcl += `  }\n`;
      }
      if (tfBlock.required_version) {
        hcl += `  required_version = ${toHclLiteral(tfBlock.required_version)}\n`;
      }
      hcl += `}\n\n`;
    }
  }

  // 4) "provider" blocks
  if (terraformJson.provider && typeof terraformJson.provider === 'object') {
    for (const [providerName, providerDefs] of Object.entries(
      terraformJson.provider as Record<string, any>,
    )) {
      const defs = ensureArray(providerDefs);
      let tmp = '';
      tmp += `provider "${providerName}" {\n`;
      for (const def of defs) {
        for (const [attr, val] of Object.entries(def as Record<string, any>)) {
          tmp += `  ${attr} = ${toHclLiteral(val)}\n`;
        }
        tmp += `}\n`;
      }
      hcl += `${tmp}\n`;
    }
  }

  // 5) "data" blocks
  if (terraformJson.data && typeof terraformJson.data === 'object') {
    for (const [dtype, dinstances] of Object.entries(
      terraformJson.data as Record<string, any>,
    )) {
      if (typeof dinstances === 'object') {
        for (const [dname, rawDef] of Object.entries(
          dinstances as Record<string, any>,
        )) {
          const dblocks = ensureArray(rawDef);
          for (const dblock of dblocks) {
            hcl += `data "${dtype}" "${dname}" {\n`;
            for (const [attr, val] of Object.entries(
              dblock as Record<string, any>,
            )) {
              hcl += `  ${attr} = ${toHclLiteral(val)}\n`;
            }
            hcl += `}\n\n`;
          }
        }
      }
    }
  }

  // 6) "output" blocks
  if (terraformJson.output && typeof terraformJson.output === 'object') {
    for (const [outName, outDefs] of Object.entries(
      terraformJson.output as Record<string, any>,
    )) {
      const defs = ensureArray(outDefs);
      for (const def of defs) {
        hcl += `output "${outName}" {\n`;
        for (const [attr, val] of Object.entries(def as Record<string, any>)) {
          hcl += `  ${attr} = ${toHclLiteral(val)}\n`;
        }
        hcl += `}\n\n`;
      }
    }
  }

  // 7) "locals" blocks
  if (terraformJson.locals && typeof terraformJson.locals === 'object') {
    hcl += `locals {\n`;
    for (const [key, val] of Object.entries(
      terraformJson.locals as Record<string, any>,
    )) {
      hcl += `  ${key} = ${toHclLiteral(val)}\n`;
    }
    hcl += `}\n\n`;
  }

  // 8) "variable" blocks
  if (terraformJson.variable && typeof terraformJson.variable === 'object') {
    for (const [varName, varDefs] of Object.entries(
      terraformJson.variable as Record<string, any>,
    )) {
      const defs = ensureArray(varDefs);
      for (const def of defs) {
        hcl += `variable "${varName}" {\n`;
        for (const [attr, val] of Object.entries(def as Record<string, any>)) {
          hcl += `  ${attr} = ${toHclLiteral(val)}\n`;
        }
        hcl += `}\n\n`;
      }
    }
  }

  return hcl;
}
