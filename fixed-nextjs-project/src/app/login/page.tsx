import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginClient from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");
  return <LoginClient />;
}
