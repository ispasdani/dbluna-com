"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Container } from "../marketing-general/container";
import { Badge } from "../marketing-general/badge";
import { SectionHeading } from "../marketing-general/section-heading";
import { SubHeading } from "../marketing-general/subHeading";
import { Scale } from "../marketing-general/scale";
import { DevopsIcon } from "../uiJsxAssets/devops-icon";
import { GraphIcon } from "../uiJsxAssets/graph-icon";
import { TruckIcon } from "../uiJsxAssets/truck-icon";
import { PhoneIcon } from "../uiJsxAssets/phone-icon";
import { WalletIcon } from "../uiJsxAssets/wallet-icon";
import { DatabaseIcon } from "../uiJsxAssets/database-icon";

export const UseCases = () => {
  const useCases = [
    {
      title: "Backend Development",
      description:
        "Design and visualize database schemas before writing migration code",
      icon: <DevopsIcon className="text-brand size-6" />,
    },
    {
      title: "Data Architecture",
      description:
        "Plan complex data models and relationships with visual clarity",
      icon: <GraphIcon className="text-brand size-6" />,
    },
    {
      title: "Startup MVPs",
      description:
        "Rapidly prototype database structures and iterate on data models",
      icon: <TruckIcon className="text-brand size-6" />,
    },
    {
      title: "Team Collaboration",
      description:
        "Work together on schema design with real-time synchronization",
      icon: <PhoneIcon className="text-brand size-6" />,
    },
    {
      title: "Database Migration",
      description:
        "Generate SQL scripts for multiple databases from visual designs",
      icon: <DatabaseIcon className="text-brand size-6" />,
    },
    {
      title: "Documentation",
      description:
        "Create professional database documentation automatically from schemas",
      icon: <WalletIcon className="text-brand size-6" />,
    },
  ];
  const [activeUseCase, setActiveUseCase] = useState<number | null>(null);
  return (
    <Container className="border-divide relative overflow-hidden border-x px-4 md:px-8">
      <div className="relative flex flex-col items-center py-20">
        <Badge text="Use Cases" />
        <SectionHeading className="mt-4">
          Across various Industries
        </SectionHeading>

        <SubHeading as="p" className="mx-auto mt-6 max-w-lg">
          We empower developers and technical teams to design, visualize,
          simulate and document database schemas efficiently
        </SubHeading>

        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase, index) => (
            <div
              onMouseEnter={() => setActiveUseCase(index)}
              key={useCase.title}
              className="relative"
            >
              {activeUseCase === index && (
                <motion.div
                  layoutId="scale"
                  className="absolute inset-0 z-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                >
                  <Scale />
                </motion.div>
              )}
              <div className="relative z-10 rounded-lg bg-gray-50 p-4 transition duration-200 hover:bg-transparent md:p-5 dark:bg-neutral-800">
                <div className="flex items-center gap-2">{useCase.icon}</div>
                <h3 className="mt-4 mb-2 text-lg font-medium">
                  {useCase.title}
                </h3>
                <p className="text-gray-600">{useCase.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
};
