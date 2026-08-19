import { useEffect, useState } from 'react';

export function useCountdown(targetMs: number | undefined | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetMs) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [targetMs]);
  const remaining = Math.max(0, (targetMs || 0) - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const label = remaining <= 0
    ? 'Starting now'
    : hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : `${minutes}m ${seconds}s`;
  return { remaining, hours, minutes, seconds, label, ready: remaining <= 0 };
}
