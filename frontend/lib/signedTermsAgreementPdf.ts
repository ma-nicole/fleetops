import { jsPDF } from "jspdf";
import { FLEETOPT_TERMS_SECTIONS, FLEETOPT_TERMS_VERSION } from "@/lib/fleetoptTermsAgreement";

export type SignedTermsPdfInput = {
  bookingId?: number | null;
  customerName: string;
  userAccountId?: number | null;
  signedAt: Date;
  ipAddress?: string | null;
  signatureFile: File;
  termsVersion?: string;
};

const MARGIN = 14;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read signature image."));
    reader.readAsDataURL(file);
  });
}

/** Build a signed Terms & Agreement PDF for upload with the booking. */
export async function buildSignedTermsAgreementPdf(input: SignedTermsPdfInput): Promise<File> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 18;

  const ensureSpace = (mm: number) => {
    if (y + mm > 285) {
      doc.addPage();
      y = 18;
    }
  };

  const paragraph = (text: string, size = 9) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(text, pageW - MARGIN * 2);
    ensureSpace(lines.length * 4.2 + 4);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4.2 + 3;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text("FleetOpt Logistics Service Agreement", MARGIN, y);
  y += 9;
  paragraph(`Version: ${input.termsVersion ?? FLEETOPT_TERMS_VERSION}`);
  paragraph(
    input.bookingId
      ? `Booking #${input.bookingId}`
      : "Booking reference will be assigned upon confirmation.",
  );
  y += 2;

  for (const section of FLEETOPT_TERMS_SECTIONS) {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text(section.title, MARGIN, y);
    y += 7;
    for (const p of section.paragraphs) paragraph(p);
    y += 2;
  }

  ensureSpace(70);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Electronic Signature & Acceptance Record", MARGIN, y);
  y += 8;

  const signedDisplay = input.signedAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  paragraph(`Customer name: ${input.customerName}`);
  if (input.userAccountId) paragraph(`User account ID: ${input.userAccountId}`);
  paragraph(`Signed date & time (PHT): ${signedDisplay}`);
  if (input.ipAddress) paragraph(`IP address: ${input.ipAddress}`);

  try {
    const dataUrl = await fileToDataUrl(input.signatureFile);
    ensureSpace(45);
    doc.text("Signature:", MARGIN, y);
    y += 4;
    doc.addImage(dataUrl, "PNG", MARGIN, y, 70, 28);
    y += 32;
  } catch {
    paragraph("Signature image could not be embedded in this PDF copy.");
  }

  paragraph(
    "The customer confirmed \"I Agree\" to these terms and provided the electronic signature shown above through the FleetOpt booking portal.",
  );

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`FleetOpt Signed Agreement · Page ${p} of ${pages}`, MARGIN, 292);
  }

  const blob = doc.output("blob");
  const bookingPart = input.bookingId ? `booking-${input.bookingId}` : "pending";
  return new File([blob], `fleetopt-signed-terms-${bookingPart}.pdf`, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}
