import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";
import {
  countUnreadNotifications,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notifications";

const router: IRouter = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  unreadOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
});

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const items = await listUserNotifications(req.appUser!.id, {
    limit: query.data.limit,
    unreadOnly: query.data.unreadOnly,
  });
  res.json(items);
});

router.get(
  "/notifications/unread-count",
  requireAuth,
  async (req, res): Promise<void> => {
    const value = await countUnreadNotifications(req.appUser!.id);
    res.json({ count: value });
  },
);

router.post(
  "/notifications/read-all",
  requireAuth,
  async (req, res): Promise<void> => {
    await markAllNotificationsRead(req.appUser!.id);
    res.sendStatus(204);
  },
);

router.post(
  "/notifications/:id/read",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = z.object({ id: z.coerce.number() }).safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const ok = await markNotificationRead(req.appUser!.id, params.data.id);
    if (!ok) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
