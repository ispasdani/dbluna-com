import Link from "next/link";
import { Article, TAG_LABELS, formatDate } from "@/lib/blog/articles";
import { ArrowRight } from "lucide-react";

export const BlogCard = ({ article }: { article: Article }) => {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group border-divide flex flex-col border p-6 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-900/50 md:p-8"
    >
      <span className="bg-brand/10 text-brand mb-4 inline-block w-fit rounded-full px-2.5 py-1 text-xs font-medium">
        {TAG_LABELS[article.tag]}
      </span>
      <h2 className="text-charcoal-700 text-lg font-medium leading-snug dark:text-neutral-100">
        {article.title}
      </h2>
      <p className="mt-3 line-clamp-3 flex-1 text-sm text-gray-600 dark:text-neutral-400">
        {article.excerpt}
      </p>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-neutral-500">
          {formatDate(article.publishedAt)} · {article.readMinutes} min read
        </span>
        <ArrowRight className="text-brand h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
};

export const BlogCardSmall = ({ article }: { article: Article }) => {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group border-divide flex items-start gap-4 border-b py-5 last:border-b-0"
    >
      <div className="flex-1">
        <span className="text-brand text-xs font-medium">
          {TAG_LABELS[article.tag]}
        </span>
        <h3 className="text-charcoal-700 mt-1 text-sm font-medium leading-snug dark:text-neutral-100">
          {article.title}
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-neutral-500">
          {formatDate(article.publishedAt)} · {article.readMinutes} min read
        </p>
      </div>
      <ArrowRight className="text-brand mt-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
};
