import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { StickyStory } from "@/components/landing/StickyStory";
import { ValueProps } from "@/components/landing/ValueProps";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { TestimonialSection } from "@/components/landing/TestimonialSection";
import { SignupCTA } from "@/components/landing/SignupCTA";
import FinalCta from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function HomePage() {
  return (
    <main className="bg-black text-white">
      <LandingNav />
      <HeroSection />
      <StickyStory />
      <ValueProps />
      <FeatureGrid />
      <TestimonialSection />
      <SignupCTA />
      <FinalCta />
      <LandingFooter />
    </main>
  );
}
