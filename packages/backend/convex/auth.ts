import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins/email-otp";

import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 400;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const trustedOrigins = [
  process.env.SITE_URL!,
  ...(process.env.ADDITIONAL_TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []),
];

async function sendSignInCode(email: string, otp: string) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiKey = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
  const from = process.env.AUTH_EMAIL_FROM;

  if (!accountId || !apiKey || !from) {
    throw new Error("Auth email is not configured");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { address: from, name: "FindPhotosOfMe" },
        to: email,
        subject: `${otp} — your FindPhotosOfMe sign-in code`,
        html: `<div style="font-family: sans-serif; padding: 20px 0"><h2>Sign in to FindPhotosOfMe</h2><p>Enter this code to sign in:</p><p style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px">${otp}</p><p style="color: #777; font-size: 13px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
        text: `Your FindPhotosOfMe sign-in code is ${otp}. It expires in 10 minutes.`,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Could not send sign-in email");
  }
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  const siteUrl = process.env.SITE_URL!;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : {},
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      // Limits are counted per IP, but visitors reach Better Auth through the Worker and Convex fetches the signing keys
      // itself, so these would be one budget for everyone. Once the keys were refused, Convex rejected every token.
      customRules: { "/convex/token": false, "/convex/jwks": false, "/get-session": false },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 3,
        storeOTP: "hashed",
        rateLimit: { window: 60, max: 3 },
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type === "sign-in") await sendSignInCode(email, otp);
        },
      }),
      crossDomain({ siteUrl }),
      convex({ authConfig }),
    ],
  });
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => authComponent.getAuthUser(ctx),
});
