import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LandingContent } from "@/components/landing-content";

export default async function LandingPage() {
  const session = await getSession();
  if (session?.role === "customer") redirect("/home");
  if (session?.role === "admin") redirect("/admin");
  if (session?.role === "courier") redirect("/admin");

  return <LandingContent />;
}
