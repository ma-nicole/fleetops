import { redirect } from "next/navigation";

export default function AuthenticationRedirectPage() {
  redirect("/modules/administration/accounts");
}
