import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/lib/auth.config";
import { areaFromPath, roleCanAccess } from "@/lib/auth-roles";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const area = areaFromPath(pathname);
  if (!area) {
    return NextResponse.next();
  }

  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.user.role;
  if (!roleCanAccess(role, area)) {
    return NextResponse.redirect(new URL("/login?error=Forbidden", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/portal/:path*", "/cockpit/:path*", "/partner/:path*"],
};
