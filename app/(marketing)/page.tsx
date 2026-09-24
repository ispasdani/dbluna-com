import { DivideX } from "@/components/marketing-general/divideX";
import { LazyMount } from "@/components/marketing-general/lazy-mount";
import { Benefits } from "@/components/marketing-sections/benefits/benefits";
import { FAQs } from "@/components/marketing-sections/faq";
import { Features } from "@/components/marketing-sections/features/features";
import { Hero } from "@/components/marketing-sections/hero";
import { HeroImage } from "@/components/marketing-sections/hero-image";
import { HowItWorksV2 } from "@/components/marketing-sections/how-it-works-v2/how-it-works-v2";
import { Pricing } from "@/components/marketing-sections/pricing";
import { UseCases } from "@/components/marketing-sections/use-cases";
import VideoSec from "@/components/marketing-sections/video-sec";
import { getProPlanId } from "@/lib/billing/pro-plan";

export default async function Home() {
  const proPlanId = await getProPlanId();

  return (
    <main>
      <DivideX />
      <Hero />
      <DivideX />
      <HeroImage />
      <DivideX />
      <div id="how-it-works">
        <LazyMount>
          <HowItWorksV2 />
        </LazyMount>
      </div>
      <DivideX />
      <div id="features">
        <LazyMount>
          <Features />
        </LazyMount>
      </div>
      <DivideX />
      <div id="use-cases">
        <UseCases />
      </div>
      <DivideX />
      <LazyMount>
        <Benefits />
      </LazyMount>
      <DivideX />
      <div id="pricing">
        <Pricing proPlanId={proPlanId} />
      </div>
      <DivideX />
      <div id="faq">
        <FAQs />
      </div>
      <DivideX />
      <VideoSec />
      <DivideX />
    </main>
  );
}
