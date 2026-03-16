//backend/src/lib/get-mobile-user.ts
import { prisma } from "./db.js";
import { verifyMobileAppToken } from "./mobile-auth.js";

export async function getMobileUserFromAuthorizationHeader(
  authorization?: string,
) {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.replace("Bearer ", "").trim();

  try {
    const payload = verifyMobileAppToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    return user;
  } catch {
    return null;
  }
}