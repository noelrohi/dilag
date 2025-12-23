import { useState, useEffect } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

function formatDuration(ms: number): string {
  const d = dayjs.duration(ms);
  const seconds = Math.floor(d.asSeconds());

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(d.asMinutes());
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function useElapsedTime(
  startTime: number,
  endTime?: number
): string {
  const [elapsed, setElapsed] = useState(() => {
    const end = endTime ?? Date.now();
    return formatDuration(end - startTime);
  });

  useEffect(() => {
    // If we have an end time, just compute once and return
    if (endTime !== undefined) {
      setElapsed(formatDuration(endTime - startTime));
      return;
    }

    // Update immediately
    setElapsed(formatDuration(Date.now() - startTime));

    // Set up interval for live updates
    const interval = setInterval(() => {
      setElapsed(formatDuration(Date.now() - startTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, endTime]);

  return elapsed;
}
