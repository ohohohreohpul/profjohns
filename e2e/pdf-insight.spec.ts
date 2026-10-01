import { test, expect } from "@playwright/test";
import { titleFromFilename, yearFromPdfDate, isPdfFile } from "../src/lib/pdf-upload";
import { shortCitation, formatInsightNote } from "../src/lib/insight";
import { pdfLinkFor, STORAGE_PDF_PREFIX } from "../src/lib/pdf-url";

const paper = { id: "W1", title: "Inferno", authors: "Garrett A. Johnson", venue: "V", year: 2023, abstract: "" };

test.describe("PDF upload helpers", () => {
  test("titles come from tidy filenames", () => {
    expect(titleFromFilename("smith_2021-bandits--FINAL.pdf")).toBe("smith 2021 bandits FINAL");
    expect(titleFromFilename(".pdf")).toBe("Untitled PDF");
  });
  test("years come from PDF dates, rejecting nonsense", () => {
    expect(yearFromPdfDate("D:20210506120000Z")).toBe(2021);
    expect(yearFromPdfDate("D:00010101")).toBeUndefined();
    expect(yearFromPdfDate(undefined)).toBeUndefined();
  });
  test("recognises PDFs by type or extension", () => {
    expect(isPdfFile(new File([""], "a.PDF"))).toBe(true);
    expect(isPdfFile(new File([""], "a.docx", { type: "application/msword" }))).toBe(false);
  });
});

test.describe("insight citations", () => {
  test("single author", () => expect(shortCitation(paper, 3)).toBe("Garrett A. Johnson (2023), p. 3"));
  test("multiple authors become et al.", () =>
    expect(shortCitation({ authors: "Eric M. Schwartz, Bradlow, Fader", year: 2014 })).toBe("Eric M. Schwartz et al. (2014)"));
  test("note keeps the verbatim quote, type and page", () => {
    const note = formatInsightNote("finding", "effects are tiny", paper, 2);
    expect(note).toContain('Finding: "effects are tiny"');
    expect(note).toContain("p. 2");
  });
});

test.describe("pdf links", () => {
  test("uploaded PDFs keep their storage reference", () =>
    expect(pdfLinkFor({ pdfUrl: `${STORAGE_PDF_PREFIX}u/pdfs/x.pdf` })).toBe(`${STORAGE_PDF_PREFIX}u/pdfs/x.pdf`));
  test("arXiv abstract links map to the PDF", () =>
    expect(pdfLinkFor({ url: "http://arxiv.org/abs/2105.02723v1" })).toBe("https://arxiv.org/pdf/2105.02723v1"));
});

test.describe("uploaded PDFs without metadata", () => {
  test("title comes from the largest text on page 1", async () => {
    const { titleFromLargestText } = await import("../src/lib/pdf-upload");
    expect(
      titleFromLargestText([
        { str: "Do You Even Need Attention?", height: 17 },
        { str: "A Stack of Feed-Forward Layers", height: 17 },
        { str: "Luke Melas-Kyriazi", height: 11 },
        { str: "Abstract", height: 11 },
      ]),
    ).toBe("Do You Even Need Attention? A Stack of Feed-Forward Layers");
  });
  test("citation falls back to the title when no author is known", () => {
    expect(shortCitation({ authors: "", year: 2021, title: "Do You Even Need Attention? A Stack of Feed-Forward Layers" }, 1)).toBe(
      '"Do You Even Need Attention? A…" (2021), p. 1',
    );
  });
});

test("ignores arXiv's sideways margin stamp when finding the title", async () => {
  const { titleFromLargestText } = await import("../src/lib/pdf-upload");
  expect(
    titleFromLargestText([
      { str: "arXiv:2105.02723v1 [cs.CV] 6 May 2021", height: 20, transform: [0, 20, -20, 0, 10, 300] },
      { str: "Do You Even Need Attention?", height: 17, transform: [17, 0, 0, 17, 100, 700] },
      { str: "Luke Melas-Kyriazi", height: 11, transform: [11, 0, 0, 11, 100, 660] },
    ]),
  ).toBe("Do You Even Need Attention?");
});
