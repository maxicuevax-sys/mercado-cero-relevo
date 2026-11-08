import type { Metadata } from "next";
import { RegisterScreen } from "@/components/auth/register-screen";
import "../acceso/access.css";
import "./register.css";

export const metadata: Metadata = { title: "Crear cuenta · Trangui", robots: { index: false, follow: false } };
export default function RegisterPage() { return <RegisterScreen />; }
