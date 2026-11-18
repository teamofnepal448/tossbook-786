import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AdminClient from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  return <AdminClient />;
}
