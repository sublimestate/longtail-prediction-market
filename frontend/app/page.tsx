import { getAllPredictions } from '@/lib/contracts';
import { HomeClient } from '@/components/HomeClient';
import type { Prediction } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let predictions: Prediction[];
  try {
    predictions = await getAllPredictions();
  } catch {
    predictions = [];
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <HomeClient initial={predictions} />
    </main>
  );
}
