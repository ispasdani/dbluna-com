import { Footer } from "@/components/marketing-general/footer";
import { Navbar } from "@/components/marketing-general/navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
