import { redirect } from "next/navigation";

export default function EmailLoginRedirect() {
  redirect("/login");
}
