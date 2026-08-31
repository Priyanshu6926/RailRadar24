'use client';

import { useEffect } from 'react';
import { useFavoritesStore } from '@/store/favorites';
import { useSearchStore } from '@/store/search';

export function StoreHydration() {
  useEffect(() => {
    useFavoritesStore.persist.rehydrate();
    useSearchStore.persist.rehydrate();
  }, []);

  return null;
}
