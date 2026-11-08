import type { Metadata } from "next";
import { AccessScreen } from "@/components/auth/access-screen";
import "./access.css";

export const metadata: Metadata = {
  title: "Iniciar sesión · Trangui",
  robots: { index: false, follow: false },
};

export default function AccessPage() {
  return <AccessScreen />;
}
