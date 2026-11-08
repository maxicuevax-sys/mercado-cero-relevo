import { handleJudgeAccess } from "@/lib/auth/access-handler";

export async function POST(request: Request) { return handleJudgeAccess(request, "sign-in"); }
