/**
 * Shared authentication helper for API routes.
 * Returns the decoded userId or throws an error with a `code` property
 * so routes can return the correct HTTP status.
 */
import { adminAuth } from "@/lib/firebase/admin";
import { NextRequest } from "next/server";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

export async function requireAuth(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Unauthorized");
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (err: any) {
    // Firebase throws on expired / malformed / revoked tokens
    throw new AuthError("Invalid or expired token");
  }
}
