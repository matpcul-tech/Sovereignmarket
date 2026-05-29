import { createClient } from '@/lib/supabase-server';
import Terminal from '@/components/Terminal';

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('*')
    .order('position', { ascending: true });

  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .order('entry_time', { ascending: false })
    .limit(50);

  return (
    <Terminal
      initialWatchlist={watchlist || []}
      initialTrades={trades || []}
    />
  );
}
