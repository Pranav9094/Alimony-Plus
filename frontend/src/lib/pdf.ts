// Tiny dependency-free PDF writer (text only, A4, Courier). Used for court
// exhibits and receipts so no new npm package is required. Swap for jspdf /
// react-pdf later if the mentor prefers one.
export type PdfLine = { text: string; bold?: boolean; size?: number };

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;

const clean = (t: string) =>
  t
    .replace(/₹/g, "Rs.")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

export function maxChars(size = 9) {
  return Math.floor((PAGE_W - 2 * MARGIN) / (size * 0.6));
}

export function wrap(text: string, width = maxChars()): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    let line = raw;
    while (line.length > width) {
      let cut = line.lastIndexOf(" ", width);
      if (cut < width / 2) cut = width;
      out.push(line.slice(0, cut));
      line = line.slice(cut).trimStart();
    }
    out.push(line);
  }
  return out;
}

export function buildPdf(lines: PdfLine[], footer = ""): Uint8Array {
  const pages: PdfLine[][] = [[]];
  let y = PAGE_H - MARGIN;
  for (const l of lines) {
    const lead = (l.size ?? 9) + 3;
    if (y - lead < MARGIN + 14) {
      pages.push([]);
      y = PAGE_H - MARGIN;
    }
    pages[pages.length - 1].push(l);
    y -= lead;
  }
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) && objects.length;
  add("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  add(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>");
  pages.forEach((pg, i) => {
    let yy = PAGE_H - MARGIN;
    let content = "BT\n";
    for (const l of pg) {
      const size = l.size ?? 9;
      yy -= size + 3;
      content += `/${l.bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${MARGIN} ${yy} Tm (${clean(l.text)}) Tj\n`;
    }
    content += `/F1 8 Tf 1 0 0 1 ${MARGIN} ${MARGIN - 10} Tm (${clean(
      `${footer}  Page ${i + 1} of ${pages.length}`.trim(),
    )}) Tj\nET`;
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
    );
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

export function downloadPdf(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
