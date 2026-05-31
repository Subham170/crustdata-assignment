/**
 * Parse JSON from Gemini responses (may include markdown fences).
 * @param {string} raw
 */
export function parseLlmJson(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonText);
}
