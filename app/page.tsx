import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import StickyStory from "@/components/landing/StickyStory";

export default function LandingPage() {
  return (
    <main style={{ background: "#FAFAF7" }}>
      <LandingNav />
      <HeroSection />
      <StickyStory />
    </main>
  );
}
