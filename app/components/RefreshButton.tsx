'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function RefreshButton() {
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" onClick={() => router.refresh()}>
      <RefreshCw className="mr-2 h-4 w-4" />
      Refresh
    </Button>
  );
}
