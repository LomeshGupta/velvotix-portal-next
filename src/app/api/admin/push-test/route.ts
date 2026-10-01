import { z } from "zod";
import { handler } from "@/lib/api";
import { notify } from "@/lib/notify";

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

  // Use the normal notification pipeline so the test appears in the bell/history
  // as well as being delivered to every registered device.
  await notify(db, { users: [body.userId] }, {
    type: "TEST",
    title: body.title,
    body: body.message,
    link: "/",
  });

  return Response.json({
    ok: true,
    message: `Test notification sent to ${user.name}.`,
  });
});
