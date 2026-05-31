import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}
