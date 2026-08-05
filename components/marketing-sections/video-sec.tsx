"use client";

import Link from "next/link";
import { Container } from "../marketing-general/container";
import { SectionHeading } from "../marketing-general/section-heading";
import { SubHeading } from "../marketing-general/subHeading";
import { ButtonWithIdGenerator } from "../marketing-general/buttonWithIdGenerator";
import { Button } from "../marketing-general/button";

const VideoSec = () => {
  return (
    <Container className="border-divide relative flex min-h-60 flex-col items-center justify-center overflow-hidden border-x px-4 py-16 md:min-h-120">
      <SectionHeading className="relative z-10 max-w-4xl text-center lg:text-6xl">
        Your Database, Designed, Documented, and Ready to Share
      </SectionHeading>
      <SubHeading as="p" className="relative z-10 mx-auto mt-6 max-w-lg">
        Start on the free plan, or jump straight into building with Pro.
      </SubHeading>
      <div className="relative z-10 mt-8 flex items-center gap-4">
        <ButtonWithIdGenerator>Start building</ButtonWithIdGenerator>
        <Button variant="secondary" as={Link} href="/pricing">
          View pricing
        </Button>
      </div>
    </Container>
  );
};

export default VideoSec;
