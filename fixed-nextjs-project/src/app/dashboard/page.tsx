import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");
  return <DashboardClient />;
}
