"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { sendEmail } from "./email";

export const send = internalAction({
  args: {
    email: v.string(),
    inviterName: v.string(),
    organizationName: v.string(),
    invitationId: v.string(),
  },
  handler: async (ctx, args) => {
    const appUrl = process.env.APP_URL ?? "http://localhost:3001";
    const acceptUrl = `${appUrl}/invite/${args.invitationId}`;

    await sendEmail({
      to: [args.email],
      subject: `You've been invited to join ${args.organizationName}`,
      text: [
        `Hi,`,
        ``,
        `${args.inviterName} has invited you to join ${args.organizationName} on OpenSchedule.`,
        ``,
        `Click the link below to accept the invitation:`,
        acceptUrl,
        ``,
        `If you don't have an account yet, you'll be prompted to create one.`,
      ].join("\n"),
    });
  },
});
