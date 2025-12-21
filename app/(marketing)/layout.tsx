import { Navbar } from "@/components/marketing-general/navbar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      <Navbar />
      {children}
    </section>
  );
}
