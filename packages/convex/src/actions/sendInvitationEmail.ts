"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { sendEmail } from "./email";
import { render } from "@react-email/render";
import { Invitation, invitationPlainText } from "@opencal/emails";

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

    const templateProps = {
      inviterName: args.inviterName,
      organizationName: args.organizationName,
      acceptUrl,
    };

    const html = await render(Invitation(templateProps));
    const text = invitationPlainText(templateProps);

    await sendEmail({
      to: [args.email],
      subject: `You've been invited to join ${args.organizationName}`,
      text,
      html,
    });
  },
});
