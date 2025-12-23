import { DivideX } from "@/components/marketing-general/divideX";
import { LogoCloud } from "@/components/marketing-general/logo-cloud";
import { Benefits } from "@/components/sections/benefits/benefits";
import { Features } from "@/components/sections/features/features";
import { Hero } from "@/components/sections/hero";
import { HeroImage } from "@/components/sections/hero-image";
import { HowItWorks } from "@/components/sections/how-it-works/how-it-works";
import { UseCases } from "@/components/sections/use-cases";

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
    </main>
  );
}
