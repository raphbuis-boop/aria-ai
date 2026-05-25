import { redirect } from "next/navigation";

// /deals will become the merged Deals tab (Showings + Transactions + CMA).
// Until that page is built, redirect to /transactions.
export default function DealsPage() {
  redirect("/transactions");
}
