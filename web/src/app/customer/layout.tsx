import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { getCurrentUser } from "@/lib/session-user";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/login");
  return (
    <div className="min-h-full">
      <AppNav />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
