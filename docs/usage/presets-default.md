---
title: Default Presets
description: Renovate's default built-in presets
---

# Default Presets

Renovate comes with many built-in presets to help you configure common scenarios quickly and consistently.

## Abandonments

### `abandonments:recommended`

This preset helps identify and handle potentially abandoned packages by setting abandonment detection thresholds.

**What it does:**

- Sets a default `abandonmentThreshold` of `1 year` for all packages
- Applies community-sourced overrides for packages that appear abandoned but are still maintained
- Helps prevent updates to truly abandoned packages while allowing updates to packages with irregular release schedules

**How it works:**
The preset combines a general rule with specific overrides:

1. **Default rule**: All packages get an `abandonmentThreshold` of `1 year`
2. **Community overrides**: Specific packages get custom thresholds based on community knowledge

**Community-sourced overrides:**
The preset includes overrides for packages that may appear abandoned but are still maintained:

- `@types/*` packages (npm): Set to `eternal` - TypeScript type definitions are maintained but may not need frequent releases
- `lodash` (npm): Set to `6 years` - While it hasn't had releases in ~4 years, it's not fully abandoned (maintainers still respond to security issues)

**Example usage:**

```json
{
  "extends": ["abandonments:recommended"]
}
```

**Included in:**
This preset is automatically included when you use:

- `config:best-practices`

**Contributing overrides:**
If you know of a package that appears abandoned but is still maintained, you can contribute to the community overrides by submitting a pull request to update the [`abandonments.json`](https://github.com/renovatebot/renovate/blob/main/lib/data/abandonments.json) file.

The overrides support these threshold values:

- A time period (e.g., `"2 years"`, `"6 months"`)
- `"eternal"` - Never consider the package abandoned

**When to use:**

- You want to avoid updating truly abandoned packages
- You're using `config:best-practices` (includes this preset automatically)
- You want community-vetted abandonment detection rules

**When not to use:**

- You prefer to manually manage abandonment detection
- You want different abandonment thresholds than the community recommendations
- You're already using a custom `abandonmentThreshold` configuration that conflicts with this preset
