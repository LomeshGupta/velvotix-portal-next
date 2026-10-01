import { z } from "zod";
import { handler } from "@/lib/api";
import { notify } from "@/lib/notify";
import { pushEnabled } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string().min(1),
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(500),
});

export const POST = handler(["SUPER_ADMIN", "ADMIN"], async ({ db, req }) => {
  const body = bodySchema.parse(await req.json());
  const users = await db.list("Users");
  const user = users.find((u) => u.id === body.userId);

  if (!user) {
    return Response.json({ message: "User not found." }, { status: 404 });
  }

  if (user.active !== "true") {
    return Response.json({ message: "This user is disabled." }, { status: 400 });
  }

  // Persist the test notification in the user's notification inbox and
  // deliver it to every registered device. Do not exclude the actor:
  // admins are allowed to test notifications to themselves.
  await notify(
    db,
    { users: [body.userId] },
    {
      type: "TEST_NOTIFICATION",
      title: body.title.trim(),
      body: body.message.trim(),
      link: "/",
    },
  );

  return Response.json({
    ok: true,
    pushConfigured: pushEnabled(),
    message: pushEnabled()
      ? `Notification sent to ${user.name}. It will appear in the bell and on enabled devices.`
      : `Notification saved for ${user.name}. Web Push is not configured, so the device popup requires VAPID configuration.`,
  });
});
