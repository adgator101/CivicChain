import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh session daily
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "CITIZEN",
        required: false,
      },
      wardNumber: {
        type: "number",
        required: false,
      },
      municipalityName: {
        type: "string",
        required: false,
      },
      districtName: {
        type: "string",
        required: false,
      },
      provinceName: {
        type: "string",
        required: false,
      },
      phone: {
        type: "string",
        required: false,
      },
    },
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    "http://localhost:3000",
  ].filter((o): o is string => Boolean(o)),
});

export type Session = typeof auth.$Infer.Session;
