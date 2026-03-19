// Placeholder file to prevent import errors during development
// This file will be overwritten by Convex when you run `npx convex dev`
export const v = {
  string: () => "string",
  number: () => "number",
  boolean: () => "boolean",
  optional: (type) => type,
  id: (table) => table,
};