import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/marketing-general/container";
import { DivideX } from "@/components/marketing-general/divideX";
import { BlogCardSmall } from "@/components/marketing-sections/blog/blog-card";
import {
  getArticleBySlug,
  getRelatedArticles,
  formatDate,
  TAG_LABELS,
  ARTICLE_SLUGS,
} from "@/lib/blog/articles";
import { JsonLd } from "@/components/seo/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dbluna.com";

export function generateStaticParams() {
  return ARTICLE_SLUGS.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  const url = `${SITE_URL}/blog/${slug}`;

  return {
    title: article.metaTitle,
    description: article.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: article.metaTitle,
      description: article.metaDescription,
      siteName: "DBLuna",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: ["DBLuna"],
      section: TAG_LABELS[article.tag],
    },
    twitter: {
      card: "summary_large_image",
      title: article.metaTitle,
      description: article.metaDescription,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const related = getRelatedArticles(slug);
  const url = `${SITE_URL}/blog/${slug}`;

  const wordCount = [
    article.lead,
    ...article.sections.flatMap((s) => s.body),
    ...article.faq.flatMap((f) => [f.question, f.answer]),
  ]
    .join(" ")
    .split(/\s+/).length;

  const articleSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.metaDescription,
        articleSection: TAG_LABELS[article.tag],
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        inLanguage: "en-US",
        wordCount,
        timeRequired: `PT${article.readMinutes}M`,
        url,
        author: {
          "@type": "Organization",
          name: "DBLuna",
          url: SITE_URL,
        },
        publisher: {
          "@type": "Organization",
          name: "DBLuna",
          url: SITE_URL,
        },
        mainEntityOfPage: { "@id": url },
        isPartOf: { "@id": `${SITE_URL}/blog#blog` },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: article.faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Blog",
            item: `${SITE_URL}/blog`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: article.title,
            item: url,
          },
        ],
      },
    ],
  };

  return (
    <main>
      <JsonLd data={articleSchema} />
      <DivideX />

      {/* ── Article header ── */}
      <Container className="border-divide border-x px-4 pt-10 pb-0 md:px-8 md:pt-16">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-500">
          <Link
            href="/blog"
            className="hover:text-charcoal-700 flex items-center gap-1.5 transition-colors dark:hover:text-neutral-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Blog
          </Link>
          <span>/</span>
          <span className="text-charcoal-700 dark:text-neutral-300">
            {TAG_LABELS[article.tag]}
          </span>
        </nav>

        <span className="bg-brand/10 text-brand mb-4 inline-block rounded-full px-2.5 py-1 text-xs font-medium">
          {TAG_LABELS[article.tag]}
        </span>
        <h1 className="text-charcoal-700 mt-3 max-w-3xl text-2xl font-medium leading-snug tracking-tight dark:text-neutral-100 md:text-3xl lg:text-4xl">
          {article.title}
        </h1>
        <p className="mt-4 text-sm text-gray-500 dark:text-neutral-500">
          <time dateTime={article.publishedAt}>
            {formatDate(article.publishedAt)}
          </time>
          {" · "}
          {article.readMinutes} min read
        </p>
      </Container>

      <DivideX className="mt-8" />

      {/* ── Article body ── */}
      <Container className="border-divide border-x px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-3xl">
          {/* Lead */}
          <p className="text-charcoal-700 text-base leading-relaxed dark:text-neutral-300 md:text-lg">
            {article.lead}
          </p>

          {/* Key points */}
          <div className="border-divide mt-8 rounded-xl border bg-gray-50 p-5 dark:bg-neutral-900/50 md:p-6">
            <p className="text-charcoal-700 mb-4 text-xs font-semibold uppercase tracking-widest dark:text-neutral-400">
              Key Takeaways
            </p>
            <ul className="flex flex-col gap-3">
              {article.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="text-brand mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-charcoal-700 text-sm dark:text-neutral-300">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sections */}
          <div className="mt-10 flex flex-col gap-10">
            {article.sections.map((section, i) => (
              <section key={i}>
                <h2 className="text-charcoal-700 mb-4 text-xl font-medium tracking-tight dark:text-neutral-100">
                  {section.heading}
                </h2>
                <div className="flex flex-col gap-4">
                  {section.body.map((paragraph, j) => (
                    <p
                      key={j}
                      className="text-base leading-[1.8] text-gray-600 dark:text-neutral-400"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* FAQ */}
          {article.faq.length > 0 && (
            <div className="mt-12">
              <DivideX className="mb-10" />
              <h2 className="text-charcoal-700 mb-6 text-xl font-medium tracking-tight dark:text-neutral-100">
                Frequently Asked Questions
              </h2>
              <dl className="flex flex-col gap-6">
                {article.faq.map((item, i) => (
                  <div key={i}>
                    <dt className="text-charcoal-700 mb-2 text-base font-medium dark:text-neutral-200">
                      {item.question}
                    </dt>
                    <dd className="text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
                      {item.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Disclaimer */}
          <p className="border-divide mt-12 border-l-2 pl-4 text-xs leading-relaxed text-gray-500 dark:text-neutral-500">
            This article was written by the DBLuna team. Information is provided
            for educational purposes. Always test schema changes in a staging
            environment before applying them to production.
          </p>
        </div>
      </Container>

      <DivideX />

      {/* ── Related articles ── */}
      {related.length > 0 && (
        <>
          <Container className="border-divide border-x px-4 py-10 md:px-8 md:py-12">
            <p className="text-charcoal-700 mb-6 text-sm font-medium uppercase tracking-widest dark:text-neutral-400">
              More from the blog
            </p>
            <div className="max-w-3xl">
              {related.map((a) => (
                <BlogCardSmall key={a.slug} article={a} />
              ))}
            </div>
          </Container>
          <DivideX />
        </>
      )}
    </main>
  );
}
