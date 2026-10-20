import { notFound } from "next/navigation";
import { WorkspaceApp } from "@/components/workspace-app";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    ![
      "dashboard",
      "intake",
      "navigator",
      "cases",
      "orders",
      "payments",
      "documents",
      "calculator",
      "settlement",
      "data-review",
      "help",
      "settings",
      "login",
    ].includes(section)
  )
    notFound();
  return <WorkspaceApp section={section} />;
}

