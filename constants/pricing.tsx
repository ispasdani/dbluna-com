import { CheckIcon } from "@/components/uiJsxAssets/check-icon";
import { CloseIcon } from "@/components/uiJsxAssets/close-icon";

export enum TierName {
  TIER_1 = "Free",
  TIER_2 = "Pro",
  TIER_3 = "Enterprise",
}

export const tiers = [
  {
    title: TierName.TIER_1,
    subtitle: "For individuals getting started",
    monthly: 0,
    yearly: 0,
    ctaText: "Get started",
    ctaLink: "/w",
    features: [
      "Up to 5 diagrams",
      "Up to 20 tables per diagram",
      "1 workspace",
      "SQL & DBML import/export",
      "Export to PNG/SVG",
      "Basic templates",
      "Public diagrams only",
      "Community support",
    ],
  },
  {
    title: TierName.TIER_2,
    subtitle: "For professionals & teams",
    monthly: 10,
    yearly: 100,
    ctaText: "Get started",
    ctaLink: "/sign-up",
    features: [
      "Unlimited diagrams & tables",
      "Unlimited workspaces",
      "Private & protected diagrams",
      "Collaboration (up to 5 members)",
      "Export to PDF, PNG, SVG, SQL, DBML",
      "Full template library",
      "Areas & sticky notes",
      "Version history",
      "AI credits available for purchase",
      "Priority support",
    ],
    featured: true,
  },
  {
    title: TierName.TIER_3,
    subtitle: "For organizations at scale",
    monthly: null,
    yearly: null,
    ctaText: "Contact sales",
    ctaLink: "/contact",
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Role-based access control",
      "SSO & advanced security",
      "Custom branding",
      "API access",
      "Audit logs",
      "Dedicated account manager",
      "Volume AI credits at discounted rates",
      "SLA & premium support",
    ],
  },
];

export const pricingTable = [
  {
    title: "Diagrams",
    tiers: [
      { title: TierName.TIER_1, value: "5" },
      { title: TierName.TIER_2, value: "Unlimited" },
      { title: TierName.TIER_3, value: "Unlimited" },
    ],
  },
  {
    title: "Tables per diagram",
    tiers: [
      { title: TierName.TIER_1, value: "20" },
      { title: TierName.TIER_2, value: "Unlimited" },
      { title: TierName.TIER_3, value: "Unlimited" },
    ],
  },
  {
    title: "Workspaces",
    tiers: [
      { title: TierName.TIER_1, value: "1" },
      { title: TierName.TIER_2, value: "Unlimited" },
      { title: TierName.TIER_3, value: "Unlimited" },
    ],
  },
  {
    title: "Team members",
    tiers: [
      { title: TierName.TIER_1, value: "1" },
      { title: TierName.TIER_2, value: "Up to 5" },
      { title: TierName.TIER_3, value: "Unlimited" },
    ],
  },
  {
    title: "SQL Import/Export",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "DBML Import/Export",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Export to PNG/SVG",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Export to PDF",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Private diagrams",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Areas & sticky notes",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Table grouping & colors",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Version history",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Schema validation",
    tiers: [
      { title: TierName.TIER_1, value: "Basic" },
      { title: TierName.TIER_2, value: "Advanced" },
      { title: TierName.TIER_3, value: "Advanced" },
    ],
  },
  {
    title: "Templates",
    tiers: [
      { title: TierName.TIER_1, value: "Basic" },
      { title: TierName.TIER_2, value: "Full library" },
      { title: TierName.TIER_3, value: "Full library + Custom" },
    ],
  },
  {
    title: "Code editor",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Minimap navigation",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "AI credits purchase",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
      { title: TierName.TIER_3, value: "Volume discount" },
    ],
  },
  {
    title: "Role-based access",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "SSO",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "API access",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Audit logs",
    tiers: [
      {
        title: TierName.TIER_1,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_2,
        value: <CloseIcon className="mx-auto size-5 text-gray-600" />,
      },
      {
        title: TierName.TIER_3,
        value: <CheckIcon className="mx-auto size-5 text-gray-600" />,
      },
    ],
  },
  {
    title: "Support",
    tiers: [
      { title: TierName.TIER_1, value: "Community" },
      { title: TierName.TIER_2, value: "Priority" },
      { title: TierName.TIER_3, value: "Dedicated + SLA" },
    ],
  },
];
