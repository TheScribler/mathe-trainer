// Liest Text aus einer PDF-Datei über Apples PDFKit (JXA) — auf diesem Mac
// gibt es kein poppler/pdftotext. Nur zum lokalen Nachschlagen beim Bauen der
// Generatoren, nicht Teil des ausgelieferten Produkts (siehe CLAUDE.md
// Abschnitt 1/3).
//
// Aufruf: osascript -l JavaScript tools/pdftext.js "<pfad.pdf>" [vonSeite] [bisSeite]
// Seiten sind 1-basiert; ohne Angabe wird die ganze Datei ausgegeben.

ObjC.import('PDFKit');

function run(argv) {
  const pfad = argv[0];
  if (!pfad) {
    return 'Aufruf: osascript -l JavaScript tools/pdftext.js "<pfad.pdf>" [vonSeite] [bisSeite]';
  }
  const url = $.NSURL.fileURLWithPath(pfad);
  const doc = $.PDFDocument.alloc.initWithURL(url);
  const seitenzahl = doc.pageCount;
  if (seitenzahl === 0) {
    return `Konnte PDF nicht öffnen: ${pfad}`;
  }
  const vonSeite = argv[1] ? parseInt(argv[1], 10) : 1;
  const bisSeite = argv[2] ? parseInt(argv[2], 10) : seitenzahl;

  let ausgabe = '';
  for (let i = vonSeite - 1; i < Math.min(bisSeite, seitenzahl); i++) {
    const seite = doc.pageAtIndex(i);
    const text = ObjC.unwrap(seite.string) || '';
    ausgabe += `--- Seite ${i + 1} ---\n${text}\n`;
  }
  return ausgabe;
}
