import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

interface AuthenticatedCustomer {
  customerId: string;
  email: string;
}

export async function getAuthenticatedCustomer(): Promise<AuthenticatedCustomer | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) {
    return null;
  }

  try {
    const payload = jwt.verify(
      session,
      process.env.JWT_SECRET!
    ) as AuthenticatedCustomer;

    return { customerId: payload.customerId, email: payload.email };
  } catch {
    return null;
  }
}
