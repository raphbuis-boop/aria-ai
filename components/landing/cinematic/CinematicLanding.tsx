import { Hero } from "./Hero";
import { Nav, SkipLink } from "./Nav";
import { CapabilityIndex, Footer, Trust, Waitlist } from "./Sections";
import { EnvZone } from "./atmosphere";
import { SmoothScroll } from "./SmoothScroll";
import { Theater } from "./Theater";

/**
 * Environments: forest (hero) → dawn → ivory (demo 01–02) → forest (demo 03–05,
 * trust) → dawn → ivory (capabilities) → dusk → forest (early access, footer).
 *
 * Aria's cinematic landing: hero → scroll-scrubbed product theater (separate
 * desktop and phone versions, still frames for reduced motion) → "nothing goes
 * out without you" → what Aria does today → early access (POST /api/waitlist).
 * No section here may overstate the product; see demo-data.ts for the rules.
 */
export default function CinematicLanding() {
  return (
    <div className="aria-landing relative bg-background text-foreground antialiased">
      <SmoothScroll />
      <SkipLink />
      <Nav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <EnvZone dir="dawn" className="h-[38svh] lg:h-[56vh]" />
        <div id="how" className="scroll-mt-0">
          <Theater />
        </div>
        <Trust />
        <EnvZone dir="dawn" className="h-[40svh] lg:h-[60vh]" />
        <CapabilityIndex />
        <EnvZone dir="dusk" className="h-[36svh] lg:h-[52vh]" />
        <Waitlist />
      </main>
      <Footer />
    </div>
  );
}
