import { redirect } from "next/navigation";

// /people will become the merged People tab (Pipeline + Clients + Inbox).
// Until that page is built, redirect to /clients.
export default function PeoplePage() {
  redirect("/clients");
}
