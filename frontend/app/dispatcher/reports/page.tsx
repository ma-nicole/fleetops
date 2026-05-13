import { redirect } from "next/navigation";

export default function DispatcherReportsRedirect() {
  redirect("/dispatcher/trip-logs");
}
