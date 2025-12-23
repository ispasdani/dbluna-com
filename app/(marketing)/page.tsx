import { DivideX } from "@/components/marketing-general/divideX";
import { LogoCloud } from "@/components/marketing-general/logo-cloud";
import { Benefits } from "@/components/marketing-sections/benefits/benefits";
import { FAQs } from "@/components/marketing-sections/faq";
import { Features } from "@/components/marketing-sections/features/features";
import { Hero } from "@/components/marketing-sections/hero";
import { HeroImage } from "@/components/marketing-sections/hero-image";
import { HowItWorks } from "@/components/marketing-sections/how-it-works/how-it-works";
import { Pricing } from "@/components/marketing-sections/pricing";
import { UseCases } from "@/components/marketing-sections/use-cases";

export default function Home() {
  return (
    <main>
      <DivideX />
      <Hero />
      <DivideX />
      <HeroImage />
      <DivideX />
      <LogoCloud />
      <DivideX />
      <HowItWorks />
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
    </main>
  );
}
