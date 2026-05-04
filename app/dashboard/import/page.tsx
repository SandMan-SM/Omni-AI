'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type Business } from '@/lib/agi-supabase';
import { ArrowLeft, Upload, FileText, ChevronDown, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

type ImportRow = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  location?: string;
  linkedin_url?: string;
};

const SAMPLE = `first_name,last_name,email,company,title,location
Sarah,Mitchell,s.mitchell@propco.com,PropCo Management,Director of Facilities,Salt Lake City
James,Okafor,jokafor@example.com,Great Salt Lake Properties,Property Manager,Murray UT`;

function parseCSV(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim());
    const row: ImportRow = {};
    headers.forEach((h, idx) => {
      const val = cells[idx];
      if (!val) return;
      if (h === 'first_name' || h === 'firstname' || h === 'first') row.first_name = val;
      else if (h === 'last_name' || h === 'lastname' || h === 'last') row.last_name = val;
      else if (h === 'email') row.email = val;
      else if (h === 'phone' || h === 'phone_number') row.phone = val;
      else if (h === 'company' || h === 'organization') row.company = val;
      else if (h === 'title' || h === 'job_title') row.title = val;
      else if (h === 'location' || h === 'city') row.location = val;
      else if (h === 'linkedin' || h === 'linkedin_url') row.linkedin_url = val;
    });
    rows.push(row);
  }
  return rows;
}

export default function ImportPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [bizOpen, setBizOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [parsed, setParsed] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    supabase.from('omni_businesses').select('*').order('display_order', { ascending: true, nullsFirst: false }).order('name').then(({ data }) => {
      if (data?.length) {
        setBusinesses(data);
        setSelectedBiz(data[0]);
      }
    });
  }, []);

  // Live workspace switcher / auto-pin sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onStorage(ev: StorageEvent) {
      if (ev.key !== 'omni_active_business_id') return;
      const v = ev.newValue;
      if (!v || v === 'all') return;
      const found = businesses.find(b => b.id === v);
      if (found) setSelectedBiz(found);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [businesses]);

  function handleParse() {
    setParsed(parseCSV(csv));
    setResult(null);
  }

  async function handleImport() {
    if (!selectedBiz || parsed.length === 0) return;
    setImporting(true);
    const r = await fetch('/api/agi/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: selectedBiz.id, rows: parsed }),
    });
    const j = await r.json();
    setImporting(false);
    if (j.ok) {
      setResult({ ok: true, msg: `Imported ${j.inserted} leads to ${selectedBiz.name}` });
      setCsv('');
      setParsed([]);
    } else {
      setResult({ ok: false, msg: j.error ?? 'Import failed' });
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = String(ev.target?.result ?? '');
      setCsv(text);
      setParsed(parseCSV(text));
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#e8e8e8' }}>
      <header style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/dashboard/leads" style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13 }}>
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <div style={{ width: 1, height: 20, background: '#222' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={14} color="#10b981" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Import Leads</span>
        </div>
        <div style={{ width: 1, height: 20, background: '#222' }} />
        <div style={{ position: 'relative' }}>
          <button onClick={() => setBizOpen(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: 8, background: '#191919',
            border: '1px solid #222', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#e8e8e8',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedBiz?.name ?? 'Select Business'}</span>
            <ChevronDown size={13} color="#555" />
          </button>
          {bizOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 6,
              background: '#111', border: '1px solid #222', borderRadius: 10,
              minWidth: 220, zIndex: 10, overflow: 'hidden',
            }}>
              {businesses.map(b => (
                <button key={b.id} onClick={() => { setSelectedBiz(b); setBizOpen(false); }} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: selectedBiz?.id === b.id ? '#191919' : 'transparent',
                  border: 'none', color: '#e8e8e8', cursor: 'pointer', fontSize: 13,
                }}>
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
        <div style={{
          background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
          padding: 24, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sparkles size={16} color="#a78bfa" />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Paste CSV or upload a file</h2>
          </div>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            Headers accepted: <code style={codeStyle}>first_name</code>, <code style={codeStyle}>last_name</code>, <code style={codeStyle}>email</code>, <code style={codeStyle}>phone</code>, <code style={codeStyle}>company</code>, <code style={codeStyle}>title</code>, <code style={codeStyle}>location</code>, <code style={codeStyle}>linkedin_url</code>
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              background: '#161616', border: '1px solid #222', fontSize: 12, color: '#94a3b8',
            }}>
              <FileText size={13} />
              Choose CSV file
              <input type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />
            </label>
            <button onClick={() => setCsv(SAMPLE)} style={{
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'transparent', border: '1px solid #222', fontSize: 12, color: '#666',
            }}>
              Use sample data
            </button>
          </div>

          <textarea
            value={csv}
            onChange={e => setCsv(e.target.value)}
            placeholder="Paste CSV here..."
            style={{
              width: '100%', minHeight: 220, background: '#0a0a0a', border: '1px solid #222',
              borderRadius: 8, padding: 14, color: '#cbd5e1', fontSize: 12, lineHeight: 1.5,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace', resize: 'vertical',
            }}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={handleParse} disabled={!csv} style={{
              padding: '8px 16px', borderRadius: 8, cursor: csv ? 'pointer' : 'not-allowed',
              background: csv ? '#191919' : '#0d0d0d',
              border: '1px solid #222', fontSize: 12, color: csv ? '#94a3b8' : '#444',
              fontWeight: 600,
            }}>
              Preview rows
            </button>
            <button onClick={handleImport} disabled={parsed.length === 0 || importing || !selectedBiz} style={{
              padding: '8px 20px', borderRadius: 8,
              cursor: parsed.length > 0 && selectedBiz ? 'pointer' : 'not-allowed',
              background: parsed.length > 0 && selectedBiz && !importing ? '#10b981' : '#0d2a1e',
              color: '#fff', border: 'none', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Upload size={12} />
              {importing ? 'Importing…' : `Import ${parsed.length} leads`}
            </button>
          </div>
        </div>

        {parsed.length > 0 && (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e1e', fontSize: 12, color: '#666' }}>
              Preview · {parsed.length} rows
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
                    {['Name', 'Email', 'Company', 'Title', 'Location'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#444', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 25).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #161616' }}>
                      <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{r.email ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{r.company ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#666' }}>{r.title ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#666' }}>{r.location ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 25 && (
                <div style={{ padding: 14, textAlign: 'center', fontSize: 11, color: '#444' }}>
                  + {parsed.length - 25} more rows
                </div>
              )}
            </div>
          </div>
        )}

        {result && (
          <div style={{
            marginTop: 20, padding: '14px 20px', borderRadius: 10,
            background: result.ok ? '#0d2a1e' : '#2a0d0d',
            border: `1px solid ${result.ok ? '#10b981' : '#f87171'}`,
            color: result.ok ? '#10b981' : '#f87171',
            fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {result.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {result.msg}
          </div>
        )}
      </div>
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  background: '#1a1a1a', padding: '2px 6px', borderRadius: 4, fontSize: 11, color: '#94a3b8',
};
