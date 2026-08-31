'use client';

import { useQuery } from '@tanstack/react-query';
import { LiveJourney } from '@/types/train';
import { ApiResponse } from '@/types/api';
import { useJourneyStore } from '@/store/journey';

async function fetchLiveJourney(trainId: string): Promise<LiveJourney> {
  const res = await fetch(`/api/train/${trainId}`);
  const json: ApiResponse<LiveJourney> = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || 'Failed to fetch live journey');
  }
  return json.data;
}

export function useLiveJourney(trainId: string) {
  const autoRefresh = useJourneyStore((state) => state.autoRefresh);

  return useQuery({
    queryKey: ['liveJourney', trainId],
    queryFn: () => fetchLiveJourney(trainId),
    enabled: Boolean(trainId),
    refetchInterval: autoRefresh ? 120_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 60 * 1000,
    retry: (n, e) => n < 2 && !/QUOTA_EXCEEDED|TOO_MANY_REQUESTS|404|400|Rate limit/.test((e as Error).message),
    retryDelay: 2000,
  });
}
