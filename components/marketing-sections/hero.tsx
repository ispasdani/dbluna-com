"use client";

import Link from "next/link";
import { Container } from "../marketing-general/container";
import { Badge } from "../marketing-general/badge";
import { Heading } from "../marketing-general/heading";
import { SubHeading } from "../marketing-general/subHeading";
import { ButtonWithIdGenerator } from "../marketing-general/buttonWithIdGenerator";
import { Button } from "../marketing-general/button";

export const Hero = () => {
  return (
    <Container className="border-divide flex flex-col items-center justify-center border-x px-4 pt-10 pb-10 md:pt-32 md:pb-20">
      <Badge text="For fast moving engineering teams." />
      <Heading className="mt-4">
        Your All-in-One Tool <br /> for Database{" "}
        <span className="text-brand">Workflow Design</span>
      </Heading>

      <SubHeading className="mx-auto mt-6 max-w-lg">
        Draw database flows, write DSL, simulate queries, and create
        documentation fast. Designed for developers and data-driven teams.
      </SubHeading>

      <div className="mt-6 flex items-center gap-4">
        <ButtonWithIdGenerator>Start building</ButtonWithIdGenerator>
        <Button variant="secondary" as={Link} href="/pricing">
          View pricing
        </Button>
      </div>
    </Container>
  );
};
