import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import StickyStory from "@/components/landing/StickyStory";
import FeatureReveal from "@/components/landing/FeatureReveal";
import Testimonial from "@/components/landing/Testimonial";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <main style={{ background: "#FAFAF7" }}>
      <LandingNav />
      <HeroSection />
      <StickyStory />
      <FeatureReveal />
      <Testimonial />
      <CTASection />
      <LandingFooter />
    </main>
  );
}
