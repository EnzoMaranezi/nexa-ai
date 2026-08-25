export type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
  badge?: string;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Test the agent with a single subject.",
    features: [
      "Limited AI sessions",
      "Limited uploads",
      "Basic flashcards",
      "Basic progress tracking",
    ],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12",
    period: "/ month",
    description: "The full academic operating system.",
    features: [
      "Unlimited study sessions",
      "Larger uploads",
      "Adaptive learning",
      "Advanced AI tutor",
      "Knowledge graph",
      "Smart reviews",
      "Full analytics",
    ],
    cta: "Start studying",
    featured: true,
    badge: "Most popular",
  },
  {
    id: "academic",
    name: "Academic",
    price: "$24",
    period: "/ month",
    description: "For research-grade workloads.",
    features: [
      "Everything in Pro",
      "Advanced research tools",
      "Academic paper analysis",
      "Citation assistance",
      "Deep document analysis",
      "Priority processing",
    ],
    cta: "Go Academic",
  },
];
