import type { Metadata } from "next";
import { Container } from "@/components/marketing-general/container";
import { Badge } from "@/components/marketing-general/badge";
import { SectionHeading } from "@/components/marketing-general/section-heading";
import { SubHeading } from "@/components/marketing-general/subHeading";
import { DivideX } from "@/components/marketing-general/divideX";
import { BlogCard } from "@/components/marketing-sections/blog/blog-card";
import { getAllArticles } from "@/lib/blog/articles";
import { JsonLd } from "@/components/seo/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dbluna.com";

export const metadata: Metadata = {
  title: "Blog – DBLuna",
  description:
    "Database design guides, DBML tutorials, ER diagram explainers, and best practices for teams who build data-driven applications.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/blog`,
    title: "Blog – DBLuna",
    description:
      "Database design guides, DBML tutorials, ER diagram explainers, and best practices for teams who build data-driven applications.",
    siteName: "DBLuna",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog – DBLuna",
    description:
      "Database design guides, DBML tutorials, ER diagram explainers, and best practices for teams who build data-driven applications.",
  },
};

export default function BlogPage() {
  const articles = getAllArticles();

  const blogListingSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE_URL}/blog#blog`,
    name: "DBLuna Blog",
    description:
      "Database design guides, DBML tutorials, and best practices from the DBLuna team.",
    url: `${SITE_URL}/blog`,
    publisher: {
      "@type": "Organization",
      name: "DBLuna",
      url: SITE_URL,
    },
    blogPost: articles.map((a) => ({
      "@type": "BlogPosting",
      headline: a.title,
      description: a.excerpt,
      url: `${SITE_URL}/blog/${a.slug}`,
      datePublished: a.publishedAt,
      dateModified: a.updatedAt,
      author: {
        "@type": "Organization",
        name: "DBLuna",
      },
    })),
  };

  return (
    <main>
      <JsonLd data={blogListingSchema} />
      <DivideX />
      <Container className="border-divide flex flex-col items-center border-x px-4 pt-10 pb-10 md:pt-20 md:pb-16">
        <Badge text="Blog" />
        <SectionHeading className="mt-4">
          Database Design, Explained
        </SectionHeading>
        <SubHeading as="p" className="mx-auto mt-6 max-w-lg px-2">
          Guides, tutorials, and best practices for engineers who care about
          data modelling, schema design, and documentation.
        </SubHeading>
      </Container>
      <DivideX />
      <Container className="border-divide border-x">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <BlogCard key={article.slug} article={article} />
          ))}
        </div>
      </Container>
      <DivideX />
    </main>
  );
}
