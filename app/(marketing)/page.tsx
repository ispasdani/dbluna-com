import { DivideX } from "@/components/marketing-general/divideX";
import { LogoCloud } from "@/components/marketing-general/logo-cloud";
import { Benefits } from "@/components/marketing-sections/benefits/benefits";
import { FAQs } from "@/components/marketing-sections/faq";
import { Features } from "@/components/marketing-sections/features/features";
import { Hero } from "@/components/marketing-sections/hero";
import { HeroImage } from "@/components/marketing-sections/hero-image";
import { HowItWorksV2 } from "@/components/marketing-sections/how-it-works-v2/how-it-works-v2";
import { Pricing } from "@/components/marketing-sections/pricing";
import { UseCases } from "@/components/marketing-sections/use-cases";
import VideoSec from "@/components/marketing-sections/video-sec";

export default function Home() {
  return (
    <main>
      <DivideX />
      <Hero />
      <DivideX />
      <HeroImage />
      <DivideX />
      <HowItWorksV2 />
      <DivideX />
      <Features />
      <DivideX />
      <UseCases />
      <DivideX />
      <Benefits />
      <DivideX />
      <Pricing />
      <DivideX />
      <FAQs />
      <DivideX />
      <VideoSec />
      <DivideX />
    </main>
  );
}
