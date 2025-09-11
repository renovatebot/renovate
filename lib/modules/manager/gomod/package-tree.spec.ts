import { describe, expect, it } from 'vitest';
import {
  parseReplaceDirectives,
  resolveGoModulePath,
  getModuleName,
  hasLocalReplaceDirectives,
} from './package-tree';

describe('gomod/package-tree', () => {
  describe('parseReplaceDirectives', () => {
    it('should parse single-line replace directives', () => {
      const content = `
module example.com/mymodule

go 1.21

require (
    github.com/example/dependency v1.0.0
)

replace github.com/example/dependency => ../dependency
replace github.com/another/module => ./local-module v1.0.0
`;

      const directives = parseReplaceDirectives(content);
      expect(directives).toEqual([
        {
          oldPath: 'github.com/example/dependency',
          newPath: '../dependency',
        },
        {
          oldPath: 'github.com/another/module',
          newPath: './local-module',
          version: 'v1.0.0',
        },
      ]);
    });

    it('should parse multi-line replace block', () => {
      const content = `
module example.com/mymodule

go 1.21

replace (
    github.com/example/dependency => ../dependency
    github.com/another/module => ./local-module
)
`;

      const directives = parseReplaceDirectives(content);
      expect(directives).toEqual([
        {
          oldPath: 'github.com/example/dependency',
          newPath: '../dependency',
        },
        {
          oldPath: 'github.com/another/module',
          newPath: './local-module',
        },
      ]);
    });

    it('should only parse local replace directives', () => {
      const content = `
module example.com/mymodule

go 1.21

replace github.com/example/dependency => ../dependency
replace github.com/remote/module => github.com/fork/module v1.0.0
`;

      const directives = parseReplaceDirectives(content);
      expect(directives).toEqual([
        {
          oldPath: 'github.com/example/dependency',
          newPath: '../dependency',
        },
      ]);
    });

    it('should handle empty content', () => {
      const directives = parseReplaceDirectives('');
      expect(directives).toEqual([]);
    });

    it('should handle content without replace directives', () => {
      const content = `
module example.com/mymodule

go 1.21

require github.com/example/dependency v1.0.0
`;

      const directives = parseReplaceDirectives(content);
      expect(directives).toEqual([]);
    });
  });

  describe('resolveGoModulePath', () => {
    it('should resolve relative paths correctly', () => {
      const baseGoModPath = '/path/to/project/moduleA/go.mod';
      const directive = {
        oldPath: 'github.com/example/dependency',
        newPath: '../dependency',
      };

      const result = resolveGoModulePath(baseGoModPath, directive);
      expect(result).toBe('/path/to/project/dependency/go.mod');
    });

    it('should handle same-directory references', () => {
      const baseGoModPath = '/path/to/project/moduleA/go.mod';
      const directive = {
        oldPath: 'github.com/example/dependency',
        newPath: './local',
      };

      const result = resolveGoModulePath(baseGoModPath, directive);
      expect(result).toBe('/path/to/project/moduleA/local/go.mod');
    });

    it('should handle nested paths', () => {
      const baseGoModPath = '/path/to/project/moduleA/go.mod';
      const directive = {
        oldPath: 'github.com/example/dependency',
        newPath: '../subfolder/dependency',
      };

      const result = resolveGoModulePath(baseGoModPath, directive);
      expect(result).toBe('/path/to/project/subfolder/dependency/go.mod');
    });
  });

  describe('getModuleName', () => {
    it('should extract module name from go.mod', () => {
      const content = `
module github.com/example/mymodule

go 1.21

require github.com/example/dependency v1.0.0
`;

      const moduleName = getModuleName(content);
      expect(moduleName).toBe('github.com/example/mymodule');
    });

    it('should return null for content without module directive', () => {
      const content = `
go 1.21

require github.com/example/dependency v1.0.0
`;

      const moduleName = getModuleName(content);
      expect(moduleName).toBeNull();
    });

    it('should handle empty content', () => {
      const moduleName = getModuleName('');
      expect(moduleName).toBeNull();
    });
  });

  describe('hasLocalReplaceDirectives', () => {
    it('should return true for content with local replace directives', () => {
      const content = `
module example.com/mymodule

go 1.21

replace github.com/example/dependency => ../dependency
`;

      const result = hasLocalReplaceDirectives(content);
      expect(result).toBe(true);
    });

    it('should return false for content without local replace directives', () => {
      const content = `
module example.com/mymodule

go 1.21

replace github.com/example/dependency => github.com/fork/module v1.0.0
`;

      const result = hasLocalReplaceDirectives(content);
      expect(result).toBe(false);
    });

    it('should return false for content without replace directives', () => {
      const content = `
module example.com/mymodule

go 1.21

require github.com/example/dependency v1.0.0
`;

      const result = hasLocalReplaceDirectives(content);
      expect(result).toBe(false);
    });
  });
});
