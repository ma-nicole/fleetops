import { redirect } from "next/navigation";

export default function AccessControlRedirectPage() {
  redirect("/modules/administration/accounts");
}
