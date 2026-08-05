import Link from "next/link";
import { Button } from "./button";
import { Container } from "./container";
import { SubHeading } from "./subHeading";
import { LogoSVG } from "../uiJsxAssets/logo";
import { LegalPlaceholder } from "./legal";

export const Footer = () => {
  const product = [
    {
      title: "Features",
      href: "/#features",
    },
    {
      title: "How It Works",
      href: "/#how-it-works",
    },
    {
      title: "Use Cases",
      href: "/#use-cases",
    },
    {
      title: "FAQ",
      href: "/#faq",
    },
  ];

  const company = [
    {
      title: "Sign In",
      href: "/sign-in",
    },
    {
      title: "About",
      href: "/about",
    },
    {
      title: "Contact",
      href: "/contact",
    },
    {
      title: "Pricing",
      href: "/pricing",
    },
  ];

  const legal = [
    {
      title: "Privacy Policy",
      href: "/privacy-policy",
    },
    {
      title: "Terms of Service",
      href: "/terms-of-service",
    },
    {
      title: "Cookie Policy",
      href: "/cookie-policy",
    },
  ];
  return (
    <Container>
      <div className="grid grid-cols-1 px-4 py-20 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        <div className="mb-6 sm:col-span-2 md:col-span-4 lg:col-span-3">
          <LogoSVG />
          <SubHeading as="p" className="mt-4 max-w-lg text-left">
            Design, document, and share database schemas visually or in DBML
          </SubHeading>
          <Button className="mt-4 mb-8 lg:mb-0" as={Link} href="/sign-up">
            Start building
          </Button>
        </div>
        <div className="col-span-1 mb-4 flex flex-col gap-2 md:col-span-1 md:mb-0">
          <p className="text-sm font-medium text-gray-600">Product</p>
          {product.map((item) => (
            <Link
              href={item.href}
              key={item.title}
              className="text-footer-link my-2 text-sm font-medium"
            >
              {item.title}
            </Link>
          ))}
        </div>
        <div className="col-span-1 mb-4 flex flex-col gap-2 md:col-span-1 md:mb-0">
          <p className="text-sm font-medium text-gray-600">Company</p>
          {company.map((item) => (
            <Link
              href={item.href}
              key={item.title}
              className="text-footer-link my-2 text-sm font-medium"
            >
              {item.title}
            </Link>
          ))}
        </div>
        <div className="col-span-1 mb-4 flex flex-col gap-2 md:col-span-1 md:mb-0">
          <p className="text-sm font-medium text-gray-600">Legal</p>
          {legal.map((item) => (
            <Link
              href={item.href}
              key={item.title}
              className="text-footer-link my-2 text-sm font-medium"
            >
              {item.title}
            </Link>
          ))}
        </div>
        <div className="col-span-1 mb-4 flex flex-col items-start md:col-span-1 md:mb-0 lg:col-span-2">
          <p className="text-footer-link text-sm font-medium">Contact Us</p>
          <SubHeading
            as="p"
            className="mt-2 text-left text-sm md:text-sm lg:text-sm"
          >
            Questions about DBLuna, or interested in an Enterprise plan? Reach
            out and we'll get back to you.
          </SubHeading>
          <Button className="mt-4" as={Link} href="/contact">
            Contact us
          </Button>
        </div>
      </div>
      <div className="my-4 flex flex-col items-center justify-between px-4 pt-8 md:flex-row">
        <p className="text-footer-link text-sm">
          © 2026 DBLuna. All rights reserved.
        </p>
        <p className="mt-4 text-sm md:mt-0">
          <LegalPlaceholder>[Add real social links]</LegalPlaceholder>
        </p>
      </div>
    </Container>
  );
};
