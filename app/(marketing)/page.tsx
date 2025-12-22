import { DivideX } from "@/components/marketing-general/divideX";
import { HeroImage } from "@/components/marketing-general/hero-image";
import { LogoCloud } from "@/components/marketing-general/logo-cloud";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works/how-it-works";

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
    </main>
  );
}
