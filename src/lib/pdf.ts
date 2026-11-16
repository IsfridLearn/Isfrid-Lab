// PDF.js helpers. Browser only — always imported dynamically from client components.
"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

const ASSETS = "/pdfjs/";

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${ASSETS}pdf.worker.min.mjs`;
  return pdfjs;
}

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({
    data,
    cMapUrl: `${ASSETS}cmaps/`,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
  }).promise;
}

/** Text of one page, with line breaks where PDF.js reports the end of a line. */
export async function extractPageText(pdf: PDFDocumentProxy, pageNumber: number) {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  let text = "";
  for (const item of content.items) {
    if (!("str" in item)) continue;
    text += item.str;
    if (item.hasEOL) text += "\n";
  }
  page.cleanup();
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractAllText(pdf: PDFDocumentProxy, onProgress?: (done: number, total: number) => void) {
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    pages.push(await extractPageText(pdf, n));
    onProgress?.(n, pdf.numPages);
  }
  return pages;
}
