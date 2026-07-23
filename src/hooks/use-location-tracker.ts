import { useEffect, useRef } from "react";
import { API_URL, companyFetch } from "@/lib/api";

const INTERVAL_MS = 30000;

export function useLocationTracker(userId: string | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const sendLocation = async () => {
      try {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await companyFetch("/caregiver-locations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  caregiver_id: userId,
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                }),
              });
            } catch {
              // silent
            }
          },
          () => {},
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
        );
      } catch {
        // silent
      }
    };

    sendLocation();
    intervalRef.current = setInterval(sendLocation, INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);
}
