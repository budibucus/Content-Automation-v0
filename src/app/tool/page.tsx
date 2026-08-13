import { redirect } from "next/navigation";
import { getAuthenticatedCustomer } from "@/lib/auth";
import { ToolForm } from "./tool-form";

export default async function ToolPage() {
  const customer = await getAuthenticatedCustomer();

  if (!customer) {
    redirect("/login");
  }

  return <ToolForm email={customer.email} />;
}
