import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes a string by removing HTML tags and trimming whitespace.
 * This prevents XSS attacks when the string is later rendered in HTML.
 */
export const sanitizeString = (input: string): string => {
  if (!input) {
    return input;
  }
  const sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return sanitized.trim();
};

/**
 * Sanitizes all string fields in an object.
 * Optionally accepts a list of specific fields to sanitize.
 *
 * @param obj - The object to sanitize
 * @param fieldsToSanitize - Optional list of field names to sanitize. If not provided, all string fields are sanitized.
 */
export const sanitizeObject = <T extends Record<string, unknown>>(
  obj: T,
  fieldsToSanitize?: string[]
): T => {
  const result = { ...obj };

  for (const key in result) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      const value = result[key];
      if (typeof value === 'string') {
        if (!fieldsToSanitize || fieldsToSanitize.includes(key)) {
          (result as Record<string, unknown>)[key] = sanitizeString(value);
        }
      }
    }
  }

  return result;
};
