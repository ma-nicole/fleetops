import { redirect } from "next/navigation";

export default function DispatcherConfirmCompletionRedirect() {
  redirect("/dispatcher/trip-logs");
}
