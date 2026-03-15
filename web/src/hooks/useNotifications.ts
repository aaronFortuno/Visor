import { useEffect, useCallback, useState } from "react";

type QuestionHandler = (sessionId: string, data: string) => void;

interface UseNotificationsReturn {
  permission: NotificationPermission | "unsupported";
  requestPermission: () => Promise<void>;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

/**
 * Hook that manages browser notifications for agent questions.
 * Requests permission and shows native OS notifications when
 * a question is detected in any session.
 */
export function useNotifications(
  onOutput: (handler: QuestionHandler) => () => void
): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem("visor-notifications") !== "false";
  });

  // Track enabled state in localStorage
  useEffect(() => {
    localStorage.setItem("visor-notifications", String(enabled));
  }, [enabled]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  // Auto-request permission on first use
  useEffect(() => {
    if (permission === "default" && enabled) {
      requestPermission();
    }
  }, [permission, enabled, requestPermission]);

  // Listen for question events and fire notifications
  useEffect(() => {
    if (!enabled || permission !== "granted") return;

    const unsub = onOutput((sessionId, data) => {
      // Only show notification if page is not focused
      if (document.hasFocus()) return;

      const truncated = data.length > 120 ? data.slice(0, 120) + "..." : data;

      new Notification("Visor — Agent Question", {
        body: truncated,
        tag: `visor-question-${sessionId}`,
        icon: "/favicon.svg",
        requireInteraction: true,
      });
    });

    return unsub;
  }, [enabled, permission, onOutput]);

  return {
    permission,
    requestPermission,
    enabled,
    setEnabled,
  };
}
