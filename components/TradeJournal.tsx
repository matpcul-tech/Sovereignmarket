'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function TradeJournal({
  trades,
  onTradesUpdate,
}: {
  trades: any[];
  onTradesUpdate: (trades: any[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    symbol: '',
    side: 'long',
    entry_price: '',
    exit_price: '',
    size: '',
    setup: '',
  });

  const today = new Date().toDateString();
  const todayTrades = trades.filter((t) => new Date(t.entry_time).toDateString() === today);
  const closedToday = todayTrades.filter((t) => t.status === 'closed');
  const totalPnl = closedToday.reduce((a, t) => a + (Number(t.pnl) || 0), 0);
  const wins = closedToday.filter((t) => (Number(t.pnl) || 0) > 0).length;
  const winRate = closedToday.length > 0 ? Math.round((wins / closedToday.length) * 100) : 0;

  // Best setup
  const setupStats: Record<string, { wins: number; total: number }> = {};
  trades.forEach((t) => {
    if (!t.setup || t.status !== 'closed') return;
    if (!setupStats[t.setup]) setupStats[t.setup] = { wins: 0, total: 0 };
    setupStats[t.setup].total++;
    if ((Number(t.pnl) || 0) > 0) setupStats[t.setup].wins++;
  });
  let bestSetup = { name: '—', rate: 0 };
  Object.entries(setupStats).forEach(([name, s]) => {
    const r = (s.wins / s.total) * 100;
    if (r > bestSetup.rate && s.total >= 2) bestSetup = { name, rate: r };
  });

  async function addTrade(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();

    const isClosed = form.exit_price && form.exit_price !== '';
    const { data, error } = await supabase
      .from('trades')
      .insert({
        symbol: form.symbol.toUpperCase(),
        side: form.side,
        entry_price: parseFloat(form.entry_price),
        exit_price: isClosed ? parseFloat(form.exit_price) : null,
        size: parseFloat(form.size),
        setup: form.setup || null,
        status: isClosed ? 'closed' : 'open',
        exit_time: isClosed ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (!error && data) {
      onTradesUpdate([data, ...trades]);
      setForm({ symbol: '', side: 'long', entry_price: '', exit_price: '', size: '', setup: '' });
      setAdding(false);
    }
  }

  async function closeTrade(id: string, exitPrice: number) {
    const supabase = createClient();
    const { data } = await supabase
      .from('trades')
      .update({ exit_price: exitPrice, exit_time: new Date().toISOString(), status: 'closed' })
      .eq('id', id)
      .select()
      .single();
    if (data) {
      onTradesUpdate(trades.map((t) => (t.id === id ? data : t)));
    }
  }

  return (
    <div>
      <div className="px-6 py-5 flex items-center justify-between bg-bg-1 border-b border-t border-line">
        <h2 className="font-serif text-xl font-bold text-text-0 tracking-tight">
          Trade <em className="italic text-amber-bright font-medium">Journal</em>
        </h2>
        <div className="flex items-center gap-3">
          <div className="text-[9px] tracking-[0.2em] uppercase text-text-2 border border-line-bright px-2.5 py-1">
            Today · {todayTrades.length} Trades
          </div>
          <button
            onClick={() => setAdding(!adding)}
            className="text-[10px] tracking-[0.15em] uppercase bg-amber text-bg-0 font-bold px-3 py-1.5 hover:bg-amber-bright transition-colors"
          >
            + Log Trade
          </button>
        </div>
      </div>

      {adding && (
        <form onSubmit={addTrade} className="p-4 bg-bg-2 border-b border-line grid grid-cols-6 gap-2">
          <input
            placeholder="Symbol"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            required
            className="bg-bg-1 border border-line px-2 py-1.5 text-[11px] text-text-0 focus:outline-none focus:border-amber-dim"
          />
          <select
            value={form.side}
            onChange={(e) => setForm({ ...form, side: e.target.value })}
            className="bg-bg-1 border border-line px-2 py-1.5 text-[11px] text-text-0 focus:outline-none"
          >
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <input
            placeholder="Entry"
            type="number"
            step="0.01"
            value={form.entry_price}
            onChange={(e) => setForm({ ...form, entry_price: e.target.value })}
            required
            className="bg-bg-1 border border-line px-2 py-1.5 text-[11px] text-text-0 focus:outline-none focus:border-amber-dim"
          />
          <input
            placeholder="Exit (optional)"
            type="number"
            step="0.01"
            value={form.exit_price}
            onChange={(e) => setForm({ ...form, exit_price: e.target.value })}
            className="bg-bg-1 border border-line px-2 py-1.5 text-[11px] text-text-0 focus:outline-none focus:border-amber-dim"
          />
          <input
            placeholder="Size"
            type="number"
            step="1"
            value={form.size}
            onChange={(e) => setForm({ ...form, size: e.target.value })}
            required
            className="bg-bg-1 border border-line px-2 py-1.5 text-[11px] text-text-0 focus:outline-none focus:border-amber-dim"
          />
          <input
            placeholder="Setup (VWAP Reclaim, etc)"
            value={form.setup}
            onChange={(e) => setForm({ ...form, setup: e.target.value })}
            className="bg-bg-1 border border-line px-2 py-1.5 text-[11px] text-text-0 focus:outline-none focus:border-amber-dim"
          />
          <button
            type="submit"
            className="col-span-6 bg-amber text-bg-0 font-bold py-2 text-[10px] tracking-[0.15em] uppercase hover:bg-amber-bright transition-colors"
          >
            Save Trade
          </button>
        </form>
      )}

      <div className="grid grid-cols-4 gap-px bg-line">
        <Stat
          label="Today P/L"
          value={`${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(0)}`}
          sub={`${closedToday.length} closed`}
          color={totalPnl >= 0 ? 'text-green-bright' : 'text-red-bright'}
        />
        <Stat
          label="Win Rate"
          value={`${winRate}%`}
          sub={`${wins} / ${closedToday.length} trades`}
        />
        <Stat
          label="Open"
          value={`${todayTrades.filter((t) => t.status === 'open').length}`}
          sub="positions today"
        />
        <Stat
          label="Best Setup"
          value={bestSetup.name}
          sub={`${bestSetup.rate.toFixed(0)}% win rate`}
          size="text-sm"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr>
              {['Time', 'Symbol', 'Side', 'Entry', 'Exit', 'Size', 'P/L', 'Setup', ''].map((h) => (
                <th
                  key={h}
                  className="bg-bg-2 px-3 py-2 text-left text-[9px] tracking-[0.15em] uppercase text-text-2 font-semibold border-b border-line"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-6 text-text-2 text-[11px]">
                  No trades logged yet. Click "Log Trade" to add your first one.
                </td>
              </tr>
            )}
            {trades.slice(0, 20).map((t) => (
              <tr key={t.id} className="hover:bg-bg-2 transition-colors">
                <td className="px-3 py-2.5 border-b border-line text-text-1">
                  {new Date(t.entry_time).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </td>
                <td className="px-3 py-2.5 border-b border-line text-text-0 font-bold">{t.symbol}</td>
                <td className="px-3 py-2.5 border-b border-line">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 tracking-wider uppercase border ${
                      t.side === 'long'
                        ? 'bg-green/10 text-green border-green-dim'
                        : 'bg-red/10 text-red border-red-dim'
                    }`}
                  >
                    {t.side}
                  </span>
                </td>
                <td className="px-3 py-2.5 border-b border-line text-text-1">${Number(t.entry_price).toFixed(2)}</td>
                <td className="px-3 py-2.5 border-b border-line text-text-1">
                  {t.exit_price ? `$${Number(t.exit_price).toFixed(2)}` : '—'}
                </td>
                <td className="px-3 py-2.5 border-b border-line text-text-1">{Number(t.size).toFixed(0)}</td>
                <td
                  className={`px-3 py-2.5 border-b border-line font-semibold ${
                    t.pnl == null ? 'text-text-2' : Number(t.pnl) >= 0 ? 'text-green' : 'text-red'
                  }`}
                >
                  {t.pnl == null
                    ? '—'
                    : `${Number(t.pnl) >= 0 ? '+' : '-'}$${Math.abs(Number(t.pnl)).toFixed(2)}`}
                </td>
                <td className="px-3 py-2.5 border-b border-line text-text-2 text-[10px]">
                  {t.setup || '—'}
                </td>
                <td className="px-3 py-2.5 border-b border-line">
                  {t.status === 'open' && (
                    <button
                      onClick={() => {
                        const px = prompt(`Close ${t.symbol} at price:`);
                        if (px) closeTrade(t.id, parseFloat(px));
                      }}
                      className="text-[9px] tracking-wider uppercase text-amber-bright hover:text-amber border border-amber-dim px-1.5 py-0.5"
                    >
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  color = 'text-text-0',
  size = 'text-2xl',
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
  size?: string;
}) {
  return (
    <div className="bg-bg-1 px-4 py-3.5 text-center">
      <div className="text-[9px] tracking-[0.15em] uppercase text-text-2 mb-1.5">{label}</div>
      <div className={`font-serif font-extrabold leading-none ${size} ${color}`}>{value}</div>
      <div className="text-[9px] text-text-2 mt-1 tracking-wider">{sub}</div>
    </div>
  );
}
