import { redirect } from "next/navigation";

// Profile settings live on the main Settings page now — this route stays
// only so existing links (dashboard avatar, /more) keep working.
export default function ProfilePage() {
  redirect("/settings");
}
