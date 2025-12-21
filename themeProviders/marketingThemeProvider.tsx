"use client";

import { ThemeProvider } from "next-themes";
import React from "react";

const MarketingThemeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system">
      {children}
    </ThemeProvider>
  );
};

export default MarketingThemeProvider;
