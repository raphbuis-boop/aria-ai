import { redirect } from "next/navigation";

/** Canonical marketing URL is `/` (middleware serves `public/landing.html`). */
export default function LandingPage() {
  redirect("/");
}
