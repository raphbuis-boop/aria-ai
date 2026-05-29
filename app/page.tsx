import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import StickyStory from "@/components/landing/StickyStory";

export default function LandingPage() {
  return (
    <main style={{ background: "#08080A" }}>
      <LandingNav />
      <HeroSection />
      <StickyStory />
    </main>
  );
}
