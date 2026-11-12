import type { Metadata } from "next";
import CinematicLanding from "@/components/landing/cinematic/CinematicLanding";

export const metadata: Metadata = {
  title: "Aria — Say it once. Aria handles the rest.",
  description:
    "Aria is the AI assistant that works alongside your CRM. Tell it what you need, a showing, a reminder, a reply, and it does the busywork. You approve anything that goes out.",
};

/** The page opens on the forest hero: match the browser chrome to --sidebar (metadata needs a literal color). */
export const viewport = { themeColor: "#153D30" };

export default function HomePage() {
  return <CinematicLanding />;
}
