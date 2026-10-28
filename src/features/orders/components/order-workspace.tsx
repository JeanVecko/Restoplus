import { DemoApp } from "@/lib/demo-app";
export default function OrderWorkspace({ mode }: { mode: "service" | "kitchen" | "cashier" }) {
  return <DemoApp page={mode === "service" ? "commandes" : mode === "kitchen" ? "cuisine" : "caisse"} />;
}
