'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function Watchlist({
  items,
  quotes,
  active,
  onSelect,
  onUpdate,
}: {
  items: any[];
  quotes: Record<string, any>;
  active: any;
  onSelect: (item: any) => void;
  onUpdate: (items: any[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newType, setNewType] = useState('stock');

  async function addSymbol(e: React.FormEvent) {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const symbol = newSymbol.trim().toUpperCase();
    const { data, error } = await supabase
      .from('watchlist')
      .insert({
        user_id: user.id,
        symbol,
        asset_type: newType,
        display_name: symbol,
        position: items.length,
      })
      .select()
      .single();
    if (!error && data) {
      onUpdate([...items, data]);
      setNewSymbol('');
      setAdding(false);
    }
  }

  async function removeSymbol(id: string) {
    const supabase = createClient();
    await supabase.from('watchlist').delete().eq('id', id);
    onUpdate(items.filter((i) => i.id !== id));
  }

  return (
    <div className="border-b border-line bg-bg-1 flex-1">
      <div className="flex justify-between items-center px-3.5 py-2.5 bg-bg-2 border-b border-line">
        <div className="text-[9px] tracking-[0.25em] uppercase text-amber-dim font-bold flex items-center gap-2">
          <span className="text-amber text-[8px]">▸</span>
          Watchlist
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="text-[9px] tracking-[0.1em] text-text-2 hover:text-amber-bright transition-colors"
        >
          + Add
        </button>
      </div>

      {adding && (
        <form onSubmit={addSymbol} className="p-3 bg-bg-2 border-b border-line">
          <div className="flex gap-2 mb-2">
            <input
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="AAPL or BTCUSDT"
              autoFocus
              className="flex-1 bg-bg-1 border border-line px-2 py-1.5 text-[11px] text-text-0 focus:outline-none focus:border-amber-dim"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="bg-bg-1 border border-line px-2 py-1.5 text-[10px] text-text-1 focus:outline-none"
            >
              <option value="stock">Stock</option>
              <option value="etf">ETF</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-amber text-bg-0 font-bold py-1.5 text-[10px] tracking-[0.15em] uppercase hover:bg-amber-bright transition-colors"
          >
            Add
          </button>
        </form>
      )}

      <div>
        {items.map((item) => {
          const q = quotes[item.symbol];
          const isActive = active?.id === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className={`grid grid-cols-[1fr_auto] gap-2 items-center px-3.5 py-2 border-b border-line cursor-pointer transition-colors group ${
                isActive ? 'bg-bg-3 border-l-2 border-l-amber pl-[12px]' : 'hover:bg-bg-2'
              }`}
            >
              <div>
                <div className="text-text-0 font-bold text-xs">{item.symbol}</div>
                <div className="text-text-2 text-[9px] uppercase tracking-wider truncate">
                  {item.display_name}
                </div>
              </div>
              <div className="text-right">
                {q ? (
                  <>
                    <div className="text-text-0 font-semibold text-[11px]">
                      ${q.price < 1 ? q.price.toFixed(4) : q.price.toFixed(2)}
                    </div>
                    <div className={`text-[10px] font-medium ${q.change >= 0 ? 'text-green' : 'text-red'}`}>
                      {q.changePercent >= 0 ? '+' : ''}
                      {q.changePercent?.toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <div className="text-text-3 text-[10px]">--</div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSymbol(item.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-text-3 hover:text-red text-[9px] absolute right-1"
                style={{ display: 'none' }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
