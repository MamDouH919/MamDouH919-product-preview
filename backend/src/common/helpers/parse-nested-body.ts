/**
 * Parse flat bracket-notation keys from multer body into nested objects.
 * e.g. { "name[ar]": "أحمد", "name[en]": "Ahmed" } → { name: { ar: "أحمد", en: "Ahmed" } }
 */
export function parseNestedBody(body: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(body)) {
    const match = key.match(/^(\w+)\[(\w+)\]$/);
    if (match) {
      const [, parent, child] = match;
      if (!result[parent]) result[parent] = {};
      result[parent][child] = body[key];
    } else {
      result[key] = body[key];
    }
  }
  return result;
}
