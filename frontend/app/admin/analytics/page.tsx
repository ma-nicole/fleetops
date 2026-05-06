import { redirect } from "next/navigation";

export default function AdminAnalyticsRedirectPage() {
  redirect("/admin/dashboard");
}
