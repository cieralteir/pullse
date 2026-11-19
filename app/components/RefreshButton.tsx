'use client';

import { useTransition } from 'react';
import { RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="icon-sm"
      disabled={isPending}
      title="Refresh"
      aria-label="Refresh"
      onClick={() => startTransition(() => router.refresh())}
    >
      <RotateCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
    </Button>
  );
}
