import { useState, useEffect, useRef } from "react";
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

  // Use refs to track values without causing effect re-runs
  const startTimeRef = useRef(startTime);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update ref when startTime changes (should be rare)
  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    // If we have an end time, compute final value and stop
    if (endTime !== undefined) {
      setElapsed(formatDuration(endTime - startTimeRef.current));
      // Clear any running interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Update immediately
    setElapsed(formatDuration(Date.now() - startTimeRef.current));

    // Only create interval if not already running
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setElapsed(formatDuration(Date.now() - startTimeRef.current));
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [endTime]); // Only depend on endTime, not startTime

  return elapsed;
}
