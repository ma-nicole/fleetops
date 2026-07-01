import { getReportExportContext } from "./reportExportContext";
import { downloadProfessionalReportPdf } from "./professionalReportPdf";

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
  extraNotes?: string[];
  filenameStem?: string;
};

function formatMoneyPhp(amount: number): string {
  return `PHP ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Payment receipt PDF using the FleetOpts professional report header.
 */
export function downloadReceiptPdf(opts: ReceiptPdfOptions): void {
  const context = getReportExportContext("Customer Payments", "Payment Receipt");
  const rows: Record<string, unknown>[] = [
    { field: "Booking", value: opts.bookingId },
    ...(opts.receiptId ? [{ field: "Receipt", value: opts.receiptId }] : []),
    ...(opts.reference ? [{ field: "Reference", value: opts.reference }] : []),
    ...(opts.amount != null && Number.isFinite(opts.amount)
      ? [{ field: "Amount paid", value: formatMoneyPhp(opts.amount) }]
      : []),
    ...(opts.paymentMethod ? [{ field: "Payment method", value: opts.paymentMethod }] : []),
    ...(opts.paidAtDisplay ? [{ field: "Paid", value: opts.paidAtDisplay }] : []),
    ...(opts.pickup ? [{ field: "Pickup", value: opts.pickup }] : []),
    ...(opts.dropoff ? [{ field: "Dropoff", value: opts.dropoff }] : []),
    ...(opts.cargo ? [{ field: "Cargo / load", value: opts.cargo }] : []),
    ...(opts.serviceType ? [{ field: "Service", value: opts.serviceType }] : []),
  ];

  downloadProfessionalReportPdf({
    context,
    reportPeriod: opts.paidAtDisplay ?? "Transaction date",
    filtersUsed: [`Booking #${opts.bookingId}`],
    executiveSummary: [
      { label: "Booking ID", value: opts.bookingId },
      ...(opts.amount != null ? [{ label: "Amount paid", value: formatMoneyPhp(opts.amount) }] : []),
      ...(opts.paymentMethod ? [{ label: "Payment method", value: opts.paymentMethod }] : []),
    ],
    tableColumns: [
      { key: "field", label: "Field" },
      { key: "value", label: "Value" },
    ],
    tableRows: rows,
    interpretation: opts.extraNotes?.join(" ") || "Official FleetOpts payment receipt for customer records.",
    analyticsType: "Descriptive",
    filenameStem: opts.filenameStem || `receipt_${opts.bookingId}`,
  });
}
