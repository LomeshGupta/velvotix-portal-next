import { z } from "zod";
import { handler } from "@/lib/api";
import { pushEnabled, pushToUser } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string().min(1),
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(500),
});

export const POST = handler(["SUPER_ADMIN", "ADMIN"], async ({ db, req }) => {
  if (!pushEnabled()) {
    return Response.json(
      {
        message:
          "Push notifications are not configured on the server. Check VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
      },
      { status: 503 },
    );
  }

  const body = bodySchema.parse(await req.json());

  const users = await db.list("Users");

  const user = users.find((u) => u.id === body.userId);

  if (!user) {
    return Response.json(
      {
        message: "User not found.",
      },
      { status: 404 },
    );
  }

  if (user.active !== "true") {
    return Response.json(
      {
        message: "This user is disabled.",
      },
      { status: 400 },
    );
  }

  await pushToUser(body.userId, {
    title: body.title,
    body: body.message,
    url: "/",
    tag: `test-${Date.now()}`,
  });

  return Response.json({
    ok: true,
    message: `Test notification sent to ${user.name}.`,
  });
});
