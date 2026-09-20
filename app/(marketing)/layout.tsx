import { ClerkProvider } from "@clerk/nextjs";
import { Footer } from "@/components/marketing-general/footer";
import { Navbar } from "@/components/marketing-general/navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The marketing tree had no ClerkProvider, so no Clerk component or hook
    // could run here — which is half of why the Pro CTA on /pricing did
    // nothing. The pricing page needs auth state to decide between opening
    // checkout and prompting sign-in. Scoped to this layout rather than the
    // root, because the (web) and (diagram) groups already provide their own.
    <ClerkProvider>
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
    </ClerkProvider>
  );
}
