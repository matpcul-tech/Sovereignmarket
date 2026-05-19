import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Terminal from '@/components/Terminal';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true });

  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .order('entry_time', { ascending: false })
    .limit(50);

  return (
    <Terminal
      userEmail={user.email!}
      initialWatchlist={watchlist || []}
      initialTrades={trades || []}
    />
  );
}
