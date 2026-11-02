import CajaApp from "@/components/caja-app";
import { isDemoMode } from "@/lib/config";

export default function Home() {
  return <CajaApp initialDemoMode={isDemoMode()} />;
}
