import { useEffect, useState } from 'react';

const MAX_REFRESH_DELAY = 60_000;

function millisecondsUntilNextMinute(now) {
  return Math.min(
    MAX_REFRESH_DELAY,
    Math.max(1_000, 60_000 - (now.getSeconds() * 1_000 + now.getMilliseconds()))
  );
}

/**
 * Keep time-dependent progress views fresh without a high-frequency timer.
 */
export function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId;
    const refresh = () => {
      const current = new Date();
      setNow(current);
      timeoutId = window.setTimeout(refresh, millisecondsUntilNextMinute(current));
    };

    const current = new Date();
    timeoutId = window.setTimeout(refresh, millisecondsUntilNextMinute(current));
    return () => window.clearTimeout(timeoutId);
  }, []);

  return now;
}
