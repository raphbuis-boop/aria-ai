'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function fmtBudget(min?: number | null, max?: number | null) {
  if (max) return `Up to $${(max / 1000).toFixed(0)}k`
  if (min) return `From $${(min / 1000).toFixed(0)}k`
  return '—'
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
        .eq('agent_id', user.id)
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
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const topLead = hotLeads[0]

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-5 pt-6 pb-2">
        <p className="text-xs font-semibold text-[#4f7bff] uppercase tracking-widest mb-1">{today}</p>
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] font-semibold leading-tight">{greeting}, {firstName}</h1>
          <div className="w-9 h-9 rounded-full bg-[#4f7bff]/20 flex items-center justify-center text-[#6f9bff] font-bold text-sm flex-shrink-0">
            {firstName[0]?.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="px-5 space-y-3 mt-4">

        {/* Briefing card */}
        <div className="bg-gradient-to-br from-[#0e1428] to-[#111230] border border-[#1e2a4e] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f7bff] animate-pulse" />
            <span className="text-[10px] font-bold text-[#4f7bff] uppercase tracking-widest">While you were away</span>
          </div>
          <p className="text-sm text-[#a0a0c0] leading-relaxed">
            {loading
              ? 'Loading your briefing...'
              : clients.length === 0
              ? 'No clients yet. Add your first client to get started.'
              : `${hotLeads.length} hot lead${hotLeads.length !== 1 ? 's' : ''} need attention. ${clients.length} active clients in your pipeline.`}
          </p>
        </div>

        {/* Action Stack label */}
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#444460] pt-2">Action Stack</p>

        {/* Hot lead card */}
        {topLead && (
          <div className="bg-[#12121e] border border-[#2a1a1a] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold tracking-widest uppercase bg-red-500/10 text-red-400 border border-red-500/20 rounded-md px-2 py-0.5">Hot Lead</span>
              <span className="text-xs text-[#444460]">now</span>
            </div>
            <Link href={`/clients/${topLead.id}`}>
              <p className="text-base font-semibold mb-1 hover:text-[#4f7bff] transition-colors">
                {topLead.name} · {topLead.town || '—'}
              </p>
            </Link>
            <p className="text-xs text-[#666680] mb-2">{topLead.status?.replace(/_/g, ' ')} · {fmtBudget(topLead.budget_min, topLead.budget_max)}</p>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }).map((_, j) => (
                  <div key={j} className={`w-1.5 h-1.5 rounded-full ${j < (topLead.lead_score ?? 0) ? 'bg-[#4f7bff]' : 'bg-[#1e1e2e]'}`} />
                ))}
              </div>
              <span className="text-[11px] text-[#444460]">Score {topLead.lead_score ?? 0}</span>
            </div>
            <div className="flex gap-2">
              <Link href={`/inbox?client=${topLead.id}`} className="flex-1 text-center bg-[#4f7bff]/12 text-[#6f9bff] border border-[#4f7bff]/20 rounded-xl py-2.5 text-xs font-semibold">
                AI text
              </Link>
              <a href={topLead.phone ? `tel:${topLead.phone}` : '#'} className="flex-1 text-center bg-green-500/12 text-green-400 border border-green-500/20 rounded-xl py-2.5 text-xs font-semibold">
                Call now
              </a>
              <button className="flex-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl py-2.5 text-xs font-semibold">
                Snooze 1h
              </button>
            </div>
          </div>
        )}

        {/* Closing card */}
        {underContract[0] && (
          <div className="bg-[#12121e] border border-[#1a2a1a] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold tracking-widest uppercase bg-green-500/10 text-green-400 border border-green-500/20 rounded-md px-2 py-0.5">Closing</span>
            </div>
            <p className="text-sm font-semibold text-white mb-1">{underContract[0].name} — under contract</p>
            <p className="text-xs text-[#666680] mb-1">{underContract[0].town || '—'}</p>
            <p className="text-xs text-green-400 mb-3">Milestone check-ins due</p>
            <Link href="/transactions" className="text-xs text-[#888898] border border-[#2a2a3e] rounded-xl px-4 py-2 inline-block font-medium">
              View deal →
            </Link>
          </div>
        )}

        {/* Empty state */}
        {!loading && clients.length === 0 && (
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-6 text-center">
            <p className="text-3xl mb-3">👥</p>
            <p className="text-[#888898] text-sm mb-3">No clients yet</p>
            <Link href="/clients?new=1" className="text-[#4f7bff] text-sm font-semibold">+ Add your first client</Link>
          </div>
        )}

        {/* Stats */}
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#444460] pt-2">Stats</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-wider mb-1.5">Hot leads</p>
            <p className="text-2xl font-semibold text-amber-400">{hotLeads.length}</p>
          </div>
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-wider mb-1.5">Active clients</p>
            <p className="text-2xl font-semibold text-white">{clients.length}</p>
          </div>
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-wider mb-1.5">Under contract</p>
            <p className="text-2xl font-semibold text-purple-400">{underContract.length}</p>
          </div>
          <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4">
            <p className="text-[11px] text-[#444460] uppercase tracking-wider mb-1.5">Buyers</p>
            <p className="text-2xl font-semibold text-[#4f7bff]">{clients.filter(c => c.client_role === 'buyer').length}</p>
          </div>
        </div>

        {/* Ask Aria */}
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#444460] pt-2">Ask Aria</p>
        <Link href="/ai" className="bg-[#12121e] border border-[#2a2a3e] rounded-2xl p-3.5 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#4f7bff] flex-shrink-0" />
          <span className="text-sm text-[#555570]">Ask Aria anything...</span>
        </Link>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 pt-1 pb-4">
          <Link href="/clients?new=1" className="bg-[#12121e] border border-[#1e1e2e] text-[#666680] rounded-full px-3.5 py-1.5 text-xs font-medium">+ New Client</Link>
          <Link href="/showings?new=1" className="bg-[#12121e] border border-[#1e1e2e] text-[#666680] rounded-full px-3.5 py-1.5 text-xs font-medium">Log Showing</Link>
          <Link href="/mls" className="bg-[#12121e] border border-[#1e1e2e] text-[#666680] rounded-full px-3.5 py-1.5 text-xs font-medium">Properties</Link>
          <Link href="/pipeline" className="bg-[#12121e] border border-[#1e1e2e] text-[#666680] rounded-full px-3.5 py-1.5 text-xs font-medium">Pipeline</Link>
        </div>

      </div>
    </div>
  )
}
