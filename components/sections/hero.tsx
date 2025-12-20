"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Container } from "../general/container";
import { Heading } from "../general/heading";
import { SubHeading } from "../general/subHeading";
import { Button } from "../general/button";
import { Badge } from "../general/badge";
import { GartnerLogo } from "../uiAssets/gartnerLogo";
import { Star } from "../uiAssets/star";
import { GartnerLogoText } from "../uiAssets/gartnerLogoText";
import { ButtonWithIdGenerator } from "../general/buttonWithIdgenerator";

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
        documentation—fast. Designed for developers and data-driven teams.
      </SubHeading>

      <div className="mt-6 flex items-center gap-4">
        <ButtonWithIdGenerator>Start building</ButtonWithIdGenerator>
        <Button variant="secondary" as={Link} href="/pricing">
          View pricing
        </Button>
      </div>
      <div className="mt-6 flex items-center gap-2">
        <GartnerLogo />
        <div className="-gap-5 flex items-center">
          {[...Array(5)].map((_, index) => (
            <motion.div
              key={index}
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              transition={{ duration: 1, delay: index * 0.05 }}
            >
              <Star key={index} />
            </motion.div>
          ))}
        </div>
        <span className="border-l border-gray-500 pl-4 text-[10px] text-gray-600 sm:text-sm">
          Innovative AI solution 2025 by
        </span>
        <GartnerLogoText className="size-12 sm:size-16" />
      </div>
    </Container>
  );
};
