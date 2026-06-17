import { redirect } from "next/navigation";

type DynamicParams = { bookingId?: string; id?: string };

type PageProps = {
  params: Promise<DynamicParams> | DynamicParams;
};

/** Redirect legacy / alternate payment paths to the canonical booking payment page. */
export async function redirectToBookingPaymentPage(props: PageProps) {
  const params = await Promise.resolve(props.params);
  const raw = (params.bookingId ?? params.id ?? "").trim();
  if (!raw) {
    redirect("/booking/payment");
  }
  redirect(`/booking/payment?bookingId=${encodeURIComponent(raw)}`);
}
