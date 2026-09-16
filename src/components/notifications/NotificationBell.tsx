import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getListNotificationsQueryKey,
  getUnreadNotificationsCountQueryKey,
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useUnreadNotificationsCount,
  type NotificationItem,
} from "@api/notifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useUnreadNotificationsCount({
    query: {
      refetchInterval: 20000,
      refetchOnWindowFocus: true,
    },
  });

  const { data: notifications, isLoading } = useListNotifications(
    { limit: 20 },
    { query: { enabled: open } },
  );

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: getUnreadNotificationsCountQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getListNotificationsQueryKey({ limit: 20 }),
    });
  }

  function handleClickNotification(notification: NotificationItem) {
    if (!notification.isRead) {
      markRead.mutate(notification.id, { onSuccess: invalidate });
    }
    if (notification.link) {
      setOpen(false);
      setLocation(notification.link);
    }
  }

  function handleMarkAll() {
    markAllRead.mutate(undefined, { onSuccess: invalidate });
  }

  const hasUnread = unreadCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notificações</span>
          {hasUnread && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : !notifications || notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Você não tem notificações.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleClickNotification(notification)}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      !notification.isRead && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.isRead && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div
                        className={cn(
                          "flex-1 space-y-0.5",
                          notification.isRead && "pl-4",
                        )}
                      >
                        <p className="text-sm font-medium leading-snug">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground leading-snug">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
