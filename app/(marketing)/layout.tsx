import { Footer } from "@/components/marketing-general/footer";
import { Navbar } from "@/components/marketing-general/navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Clerk is provided once from app/layout.tsx, so the pricing page's Pro CTA
  // still gets auth state here. It used to be mounted in this layout, which
  // meant checkout's redirect to /d unmounted the provider mid-navigation —
  // see the comment in app/layout.tsx.
  return (
    <section
      className="bg-background"
      style={
        {
          "--background": "#ffffff",
          "--foreground": "#111827",
        } as React.CSSProperties
      }
    >
      <Navbar />
      {children}
      <Footer />
    </section>
  );
}
