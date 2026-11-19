'use client';

import { useEffect, useState } from 'react';
import { Timer, TimerOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const REFRESH_INTERVAL_MS = 60_000;
const STORAGE_KEY = 'pullse:auto-refresh';

export function AutoRefresh() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);

  // Load the saved preference after mount to avoid a hydration mismatch.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'off') setEnabled(false);
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      // Skip refreshes while the tab is hidden to avoid burning GitHub rate limit.
      if (!document.hidden) router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router, enabled]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {}
  };

  const label = enabled ? 'Disable background sync' : 'Enable background sync';

  return (
    <Button
      variant="outline"
      size="icon-sm"
      title={label}
      aria-label={label}
      aria-pressed={enabled}
      onClick={toggle}
    >
      {enabled ? <Timer className="h-4 w-4" /> : <TimerOff className="h-4 w-4" />}
    </Button>
  );
}
