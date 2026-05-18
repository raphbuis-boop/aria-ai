import { redirect } from "next/navigation";

/**
 * Guests normally never hit this route: middleware rewrites `/` → `/landing.html`.
 * Fallback avoids bouncing through `/landing` (iframe + app chrome).
 */
export default function HomePage() {
  redirect("/landing.html");
}
