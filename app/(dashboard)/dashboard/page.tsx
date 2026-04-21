'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function fmtBudget(min?: number | null, max?: number | null) {
  if (max) return `Up to $${(max / 1000).toFixed(0)}k`
  if (min) return `From $${(min / 1000).toFixed(0)}k`
  return '—'
}

function pipelineTotal(clients: { budget_max: number | null }[]) {
  const total = clients.reduce((s, c) => s + (c.budget_max ?? 0), 0)
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (total >= 1_000) return `$${Math.round(total / 1_000)}k`
  return `$${total}`
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('clients')
        .select('id, name, town, status, lead_score, budget_min, budget_max, phone, client_role')
        .order('lead_score', { ascending: false })
        .limit(20)
      setClients(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const hotLeads = clients.filter(c => (c.lead_score ?? 0) >= 7)
  const underContract = clients.filter(c => c.status === 'under_contract')
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
  const initial = firstName[0]?.toUpperCase() || 'A'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const topLead = hotLeads[0]
  const closingLead = underContract[0]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f0eee8] pb-28">
      <div className="px-5 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#4f7bff] mb-1">{today}</p>
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] font-semibold leading-tight text-[#f0eee8]">{greeting}, {firstName}</h1>
          <div className="w-9 h-9 rounded-full bg-[#4f7bff]/20 flex items-center justify-center text-[13px] font-bold text-[#6f9bff] flex-shrink-0">
            {initial}
          </div>
        </div>
      </div>

      <div className="px-5 mt-[18px]">
        <div className="bg-gradient-to-br from-[#0e1428] to-[#111230] border-[0.5px] border-[#1e2a4e] rounded-[20px] p-[18px]">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f7bff] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[1px] text-[#4f7bff]">While you were away</span>
          </div>
          <p className="text-sm text-[#a0a0c0] leading-[1.6]">
            {loading ? (
              'Loading your briefing...'
            ) : clients.length === 0 ? (
              'No clients yet. Add your first client to get started.'
            ) : (
              <>
                {hotLeads.length} hot lead{hotLeads.length !== 1 ? 's' : ''} need attention.{' '}
                Top lead: <span className="text-[#d0d0e8] font-medium">{topLead?.name ?? '—'}</span>
                {topLead?.status ? <> ({topLead.status.replace(/_/g, ' ')})</> : null}.
                {' '}<span className="text-[#d0d0e8] font-medium">{clients.length} active clients</span>.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center justify-between mt-5 mb-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460]">Action Stack</p>
          <button
            type="button"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] rounded-[20px] px-3 py-1 text-[11px] font-semibold text-[#444460]"
          >
            Focus mode
          </button>
        </div>

        {topLead && (
          <div className="bg-[#0f0f1e] border-[0.5px] border-[#2a1a1a] rounded-[20px] p-[18px] mb-2.5">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center rounded-md bg-[#ff5050]/15 text-[#ff6060] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px]">Hot Lead</span>
              <span className="text-[11px] text-[#444460]">now</span>
            </div>
            <Link href={`/clients/${topLead.id}`}>
              <p className="text-base font-semibold text-[#f0eee8] mb-0.5">
                {topLead.name}{topLead.town ? ` · ${topLead.town}` : ''}
              </p>
            </Link>
            <p className="text-xs text-[#666680] mb-1">{topLead.status?.replace(/_/g, ' ') ?? '—'}</p>
            <div className="flex items-center gap-2 mb-[14px]">
              <div className="flex gap-[3px]">
                {Array.from({ length: 10 }).map((_, j) => (
                  <div
                    key={j}
                    className={`w-1.5 h-1.5 rounded-full ${j < (topLead.lead_score ?? 0) ? 'bg-[#4f7bff]' : 'bg-[#1e1e2e]'}`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-[#666680]">Lead score {topLead.lead_score ?? 0}</span>
            </div>
            <div className="flex gap-2">
              <a
                href={topLead.phone ? `tel:${topLead.phone}` : '#'}
                className="flex-1 text-center bg-[#50dc78]/12 text-[#50dc78] border-[0.5px] border-[#50dc78]/20 rounded-[9px] px-3 py-[7px] text-xs font-semibold"
              >
                Call now
              </a>
              <Link
                href={`/clients/${topLead.id}`}
                className="flex-1 text-center bg-[#4f7bff]/12 text-[#6f9bff] border-[0.5px] border-[#4f7bff]/20 rounded-[9px] px-3 py-[7px] text-xs font-semibold"
              >
                AI text
              </Link>
              <button
                type="button"
                className="flex-1 bg-[#ffb832]/10 text-[#ffb832] border-[0.5px] border-[#ffb832]/20 rounded-[9px] px-3 py-[7px] text-xs font-semibold"
              >
                Snooze 1h
              </button>
            </div>
          </div>
        )}

        {closingLead && (
          <div className="bg-[#0f0f1e] border-[0.5px] border-[#1a2a1a] rounded-[20px] p-[18px] mb-2.5">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center rounded-md bg-[#50dc78]/10 text-[#50dc78] border-[0.5px] border-[#50dc78]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.8px]">Closing</span>
            </div>
            <p className="text-[15px] font-semibold text-[#f0eee8] mb-0.5">
              {closingLead.name} — under contract
            </p>
            {closingLead.town ? (
              <p className="text-xs text-[#666680] mb-0.5">{closingLead.town}</p>
            ) : null}
            <p className="text-xs text-[#50dc78] mb-3">Milestone check-ins due</p>
            <Link
              href="/transactions"
              className="inline-block bg-transparent border-[0.5px] border-[#2a2a3e] text-[#888] rounded-[12px] px-4 py-2.5 text-[13px] font-semibold"
            >
              View deal →
            </Link>
          </div>
        )}

        {!loading && clients.length === 0 && (
          <div className="bg-[#0f0f1e] border-[0.5px] border-[#1c1c2e] rounded-[20px] p-6 text-center mb-2.5">
            <p className="text-3xl mb-3">👥</p>
            <p className="text-[#888898] text-sm mb-3">No clients yet</p>
            <Link href="/clients?new=1" className="text-[#4f7bff] text-sm font-semibold">
              + Add your first client
            </Link>
          </div>
        )}

        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460] mt-5 mb-2.5">Stats</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#0d0d1c] border-[0.5px] border-[#1a1a2c] rounded-[18px] p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-[0.8px] mb-1.5 font-medium">Pipeline</p>
            <p className="text-2xl font-semibold text-[#4f7bff] leading-none">{pipelineTotal(clients)}</p>
          </div>
          <div className="bg-[#0d0d1c] border-[0.5px] border-[#1a1a2c] rounded-[18px] p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-[0.8px] mb-1.5 font-medium">Hot leads</p>
            <p className="text-2xl font-semibold text-[#ffb832] leading-none">{hotLeads.length}</p>
          </div>
          <div className="bg-[#0d0d1c] border-[0.5px] border-[#1a1a2c] rounded-[18px] p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-[0.8px] mb-1.5 font-medium">Active clients</p>
            <p className="text-2xl font-semibold text-[#f0eee8] leading-none">{clients.length}</p>
          </div>
          <div className="bg-[#0d0d1c] border-[0.5px] border-[#1a1a2c] rounded-[18px] p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-[0.8px] mb-1.5 font-medium">Closings</p>
            <p className="text-2xl font-semibold text-[#50dc78] leading-none">{underContract.length}</p>
          </div>
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460] mt-5 mb-2.5">Ask Aria</p>
        <Link
          href="/ai"
          className="flex items-center gap-2.5 bg-[#12121e] border-[0.5px] border-[#2a2a3e] rounded-[14px] px-4 py-[13px]"
        >
          <span className="w-2 h-2 rounded-full bg-[#4f7bff] flex-shrink-0" />
          <span className="text-sm text-[#555570]">Ask Aria anything...</span>
        </Link>

        <div className="flex flex-wrap gap-[7px] mt-4 pb-2">
          <Link
            href="/clients?new=1"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] text-[#666680] rounded-[20px] px-[14px] py-[7px] text-xs font-medium"
          >
            + New Client
          </Link>
          <Link
            href="/showings?new=1"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] text-[#666680] rounded-[20px] px-[14px] py-[7px] text-xs font-medium"
          >
            Log Showing
          </Link>
          <Link
            href="/mls"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] text-[#666680] rounded-[20px] px-[14px] py-[7px] text-xs font-medium"
          >
            Properties
          </Link>
          <Link
            href="/pipeline"
            className="bg-[#12121e] border-[0.5px] border-[#1e1e2e] text-[#666680] rounded-[20px] px-[14px] py-[7px] text-xs font-medium"
          >
            Pipeline
          </Link>
        </div>
      </div>
    </div>
  )
}
