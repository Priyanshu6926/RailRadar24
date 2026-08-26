'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { StationLiveBoardView } from '@/features/stations/StationLiveBoardView';

import { useParams } from 'next/navigation';

export default function StationDetailPage({ params }: { params?: { code: string } }) {
  const routeParams = useParams();
  const stationCode = ((routeParams?.code as string) || params?.code || 'NDLS').toString().toUpperCase();

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/stations"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-rail-blue transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Station Directory</span>
        </Link>
      </div>

      <StationLiveBoardView stationCode={stationCode} />
    </div>
  );
}
