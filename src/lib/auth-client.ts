"use client";

import { createAuthClient } from "better-auth/react";

// No baseURL — better-auth defaults to same-origin `/api/auth`, which works on
// localhost, Vercel, and preview deploys without baking NEXT_PUBLIC_APP_URL.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
