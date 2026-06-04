'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError('');
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signInError) {
      setError(signInError.message);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative z-10 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-amber relative mb-6">
            <div className="absolute inset-1 border border-amber-dim" />
            <span className="font-serif text-2xl font-black text-amber-bright">S</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-text-0 mb-2 tracking-tight">
            Schwabach's <em className="italic text-amber-bright font-medium">Market</em>
          </h1>
          <p className="text-text-2 text-[10px] tracking-[0.3em] uppercase">
            Intraday Intelligence Terminal
          </p>
        </div>

        <div className="bg-bg-1 border border-line p-8">
          {status === 'sent' ? (
            <div className="text-center py-6">
              <div className="text-amber-bright font-serif text-lg mb-3">Check your email</div>
              <div className="text-text-1 text-xs leading-relaxed">
                We sent a magic link to <span className="text-text-0">{email}</span>.
                Click it to sign in.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-[9px] tracking-[0.25em] uppercase text-text-2 mb-3">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@example.com"
                className="w-full bg-bg-2 border border-line px-4 py-3 text-text-0 font-mono text-sm focus:outline-none focus:border-amber-dim transition-colors mb-6"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full bg-amber text-bg-0 font-bold py-3 text-xs tracking-[0.2em] uppercase hover:bg-amber-bright transition-colors disabled:opacity-50"
              >
                {status === 'sending' ? 'Sending…' : 'Send Magic Link'}
              </button>
              {error && (
                <div className="text-red text-xs mt-4">{error}</div>
              )}
            </form>
          )}
        </div>

        <div className="text-center mt-8 text-[9px] tracking-[0.2em] uppercase text-text-2">
          Intraday Intelligence Terminal
        </div>
      </div>
    </div>
  );
}
