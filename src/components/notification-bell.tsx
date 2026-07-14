import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";

export function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <Link to="/notifications">
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full gradient-primary px-1 text-[10px] font-semibold text-white shadow-glow">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>
    </Link>
  );
}
