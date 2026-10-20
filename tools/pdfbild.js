// Rendert eine PDF-Seite als PNG über Apples PDFKit (JXA) — nur zum lokalen
// Nachschlagen beim Bauen der Generatoren (Matrizen-Layouts, die die reine
// Textextraktion in pdftext.js durcheinanderbringt), nicht Teil des
// ausgelieferten Produkts (siehe CLAUDE.md Abschnitt 1/3).
//
// Aufruf: osascript -l JavaScript tools/pdfbild.js "<pfad.pdf>" <seite> "<ziel.png>" [breite]
// Seite ist 1-basiert.

ObjC.import('PDFKit');
ObjC.import('Foundation');
ObjC.import('AppKit');

function run(argv) {
  const pfad = argv[0];
  const seite = parseInt(argv[1], 10);
  const ziel = argv[2];
  const breite = argv[3] ? parseFloat(argv[3]) : 1600;
  if (!pfad || !seite || !ziel) {
    return 'Aufruf: osascript -l JavaScript tools/pdfbild.js "<pfad.pdf>" <seite> "<ziel.png>" [breite]';
  }
  const url = $.NSURL.fileURLWithPath(pfad);
  const doc = $.PDFDocument.alloc.initWithURL(url);
  const seitenzahl = doc.pageCount;
  if (seite < 1 || seite > seitenzahl) {
    return `Seite ${seite} außerhalb des Bereichs (1..${seitenzahl}).`;
  }
  const pdfSeite = doc.pageAtIndex(seite - 1);
  const box = $.kPDFDisplayBoxMediaBox;
  const rahmen = pdfSeite.boundsForBox(box);
  const faktor = breite / rahmen.size.width;
  const groesse = $.NSMakeSize(rahmen.size.width * faktor, rahmen.size.height * faktor);
  const bild = pdfSeite.thumbnailOfSizeForBox(groesse, box);

  const tiffDaten = bild.TIFFRepresentation;
  const bitmap = $.NSBitmapImageRep.imageRepWithData(tiffDaten);
  const pngDaten = bitmap.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
  pngDaten.writeToFileAtomically(ziel, true);
  return `Geschrieben: ${ziel} (${groesse.width}x${groesse.height})`;
}
