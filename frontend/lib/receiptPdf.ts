import { jsPDF } from "jspdf";

function formatMoneyPhp(amount: number): string {
  return `PHP ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type ReceiptPdfOptions = {
  bookingId: string;
  receiptId?: string;
  reference?: string;
  amount?: number;
  paymentMethod?: string;
  paidAtDisplay?: string;
  pickup?: string;
  dropoff?: string;
  cargo?: string;
  serviceType?: string;
  /** Printed below detail lines (e.g. feedback snippet). */
  extraNotes?: string[];
  filenameStem?: string;
};

/**
 * Builds a simple ASCII-safe receipt PDF (Helvetica — avoids ₱ glyph issues).
 */
export function downloadReceiptPdf(opts: ReceiptPdfOptions): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 18;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > 285) {
      doc.addPage();
      y = 18;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FleetOpt", margin, y);
  y += 9;

  doc.setFontSize(11);
  doc.text("Payment receipt", margin, y);
  y += 10;

  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 9;

  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const labelText = `${label}:`;
    doc.text(labelText, margin, y);
    doc.setFont("helvetica", "normal");
    const labelW = doc.getTextWidth(labelText);
    const valueLines = doc.splitTextToSize(value || "—", pageW - margin * 2 - labelW - 4);
    doc.text(valueLines, margin + labelW + 3, y);
    y += Math.max(valueLines.length * 5.2, 6.5);
    ensureSpace(12);
  };

  doc.setTextColor(30);
  row("Booking", opts.bookingId);
  if (opts.receiptId) row("Receipt", opts.receiptId);
  if (opts.reference) row("Reference", opts.reference);
  if (opts.amount != null && Number.isFinite(opts.amount)) row("Amount paid", formatMoneyPhp(opts.amount));
  if (opts.paymentMethod) row("Payment method", opts.paymentMethod);
  if (opts.paidAtDisplay) row("Paid", opts.paidAtDisplay);
  if (opts.pickup) row("Pickup", opts.pickup);
  if (opts.dropoff) row("Dropoff", opts.dropoff);
  if (opts.cargo) row("Cargo / load", opts.cargo);
  if (opts.serviceType) row("Service", opts.serviceType);

  if (opts.extraNotes?.length) {
    y += 4;
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Notes", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const note of opts.extraNotes) {
      const lines = doc.splitTextToSize(note, pageW - margin * 2);
      ensureSpace(lines.length * 4.5 + 4);
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 3;
    }
  }

  y += 6;
  ensureSpace(10);
  doc.setFontSize(8);
  doc.setTextColor(120);
  const footer = `Generated ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} — Philippines (PHT)`;
  doc.text(footer, margin, y);

  const stem = (opts.filenameStem || opts.bookingId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  doc.save(`fleetopt-receipt-${stem}.pdf`);
}
