import React, { useState, useEffect } from 'react';
import { useSearch } from '../context/SearchContext';
import { useData } from '../context/DataContext';
import DashboardCard from '../components/ui/DashboardCard';
import StatusChip from '../components/ui/StatusChip';
import type { Patient } from '../context/DataContext';

const VISIT_HISTORY: Record<string, { date: string; doctor: string; department: string; diagnosis: string; notes: string; prescriptions: string[] }[]> = {
  p6: [
    { date: '2026-04-03', doctor: 'Dr. Linda Kamau', department: 'General', diagnosis: 'Type 2 Diabetes — Controlled', notes: 'Metformin dosage adjusted. HbA1c improved to 7.2%. Next review in 3 months.', prescriptions: ['Metformin 500mg – Twice daily for 90 days'] },
    { date: '2026-01-15', doctor: 'Dr. Linda Kamau', department: 'General', diagnosis: 'Type 2 Diabetes — Uncontrolled', notes: 'HbA1c at 9.1%. Commenced Metformin, lifestyle counselling provided.', prescriptions: ['Metformin 500mg – Once daily for 30 days'] },
    { date: '2025-10-02', doctor: 'Dr. James Odhiambo', department: 'General', diagnosis: 'Routine Check-up', notes: 'Fasting glucose slightly elevated. Referred for HbA1c. No medication changes.', prescriptions: [] },
  ],
  p1: [
    { date: '2026-04-03', doctor: 'Dr. Anthony Maina', department: 'Cardiology', diagnosis: 'Hypertension — Stage 2', notes: 'BP 145/95. Amlodipine continued. Dietary salt restriction advised. ECG within normal limits.', prescriptions: ['Amlodipine 10mg – Once daily for 30 days', 'Furosemide 40mg – Once daily for 14 days'] },
    { date: '2026-02-10', doctor: 'Dr. Anthony Maina', department: 'Cardiology', diagnosis: 'Hypertension — Stage 1', notes: 'Initial diagnosis. Commenced antihypertensive therapy.', prescriptions: ['Amlodipine 5mg – Once daily for 30 days'] },
  ],
};

const PatientProfilePage: React.FC = () => {
  const { patients } = useData();
  const { searchQuery, setSearchQuery } = useSearch();
  const [search, setSearch] = useState(searchQuery);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'vitals' | 'prescriptions' | 'referrals'>('history');

  // Sync local search with global search
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setSearchQuery(val);
  };

  const filteredPatients = patients.filter(p => {
    const s = search.toLowerCase();
    if (!s) return true;
    
    // Basic info
    if (
      p.name.toLowerCase().includes(s) ||
      p.nationalId?.toLowerCase().includes(s) ||
      p.tokenId?.toLowerCase().includes(s) ||
      p.diagnosis?.toLowerCase().includes(s) ||
      p.consultationNotes?.toLowerCase().includes(s)
    ) return true;

    // Prescriptions
    if (p.prescriptions?.some(rx => 
      rx.medicineName.toLowerCase().includes(s) || 
      rx.instructions.toLowerCase().includes(s)
    )) return true;

    // Referrals
    if (p.referrals?.some(ref => 
      ref.reason.toLowerCase().includes(s) || 
      ref.toSpecialty.toLowerCase().includes(s)
    )) return true;

    // Visit History
    const history = VISIT_HISTORY[p.id] || [];
    if (history.some(v => 
      v.diagnosis.toLowerCase().includes(s) || 
      v.notes.toLowerCase().includes(s) ||
      v.prescriptions.some(rx => rx.toLowerCase().includes(s))
    )) return true;

    return false;
  });

  const visits = selected ? (VISIT_HISTORY[selected.id] || []) : [];

  const vitals = selected?.vitals || [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[2.5rem] font-extrabold text-primary tracking-tight leading-none mb-2">Patient EMR</h1>
          <p className="text-on-surface-variant font-medium">Longitudinal medical records and clinical history</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left: Patient Search List */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="flex items-center gap-2 bg-surface-container-low px-4 py-3 rounded-2xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-outline text-sm">search</span>
            <input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-sm w-full placeholder:text-outline"
              placeholder="Search by name, ID no. or token…"
            />
          </div>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {filteredPatients.map(p => (
              <button key={p.id}
                onClick={() => { setSelected(p); setActiveTab('history'); }}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${selected?.id === p.id
                  ? 'border-primary bg-primary/5 shadow-md scale-[1.02]'
                  : 'border-slate-100 bg-surface-container-lowest hover:border-teal-500/30 hover:bg-surface-container-low shadow-sm'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-on-surface truncate">{p.name}</p>
                    <p className="text-[10px] text-on-surface-variant">{p.age}y · {p.gender} · {p.department}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[10px] text-primary">{p.tokenId}</span>
                      <StatusChip label={p.status} variant={p.status === 'served' ? 'success' : p.status === 'in-progress' ? 'info' : p.status === 'admitted' ? 'error' : 'neutral'} dot />
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filteredPatients.length === 0 && (
              <p className="text-center text-sm text-on-surface-variant py-8">No patients found</p>
            )}
          </div>
        </div>

        {/* Right: EMR Detail */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {!selected ? (
            <DashboardCard className="h-64 flex items-center justify-center">
              <div className="text-center space-y-3">
                <span className="material-symbols-outlined text-5xl text-outline">person_search</span>
                <p className="text-on-surface-variant font-medium">Select a patient to view their medical record</p>
              </div>
            </DashboardCard>
          ) : (
            <>
              {/* Patient Banner */}
              <DashboardCard className="p-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xl">
                    {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-extrabold text-on-surface">{selected.name}</h2>
                    <p className="text-sm text-on-surface-variant">{selected.age} years · {selected.gender} · Nat. ID: {selected.nationalId}</p>
                    <p className="text-sm text-on-surface-variant">{selected.phone} · {selected.department}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-mono text-lg font-extrabold text-primary">{selected.tokenId}</p>
                    <StatusChip label={selected.status} variant={selected.status === 'served' ? 'success' : selected.status === 'in-progress' ? 'info' : selected.status === 'admitted' ? 'error' : 'neutral'} dot />
                  </div>
                </div>

                {selected.diagnosis && (
                  <div className="mt-4 pt-4 border-t border-outline-variant/10 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-1">Last Diagnosis</p>
                      <p className="font-semibold text-on-surface">{selected.diagnosis}</p>
                    </div>
                    {selected.assignedDoctor && (
                      <div>
                        <p className="text-xs text-on-surface-variant uppercase tracking-widest mb-1">Attending Doctor</p>
                        <p className="font-semibold text-on-surface">{selected.assignedDoctor}</p>
                      </div>
                    )}
                  </div>
                )}
              </DashboardCard>

              {/* Tabs */}
              <div className="flex bg-surface-container-low rounded-2xl p-1 gap-1">
                {([
                  { key: 'history',       label: 'Visit History', icon: 'history' },
                  { key: 'vitals',        label: 'Vitals',        icon: 'monitor_heart' },
                  { key: 'prescriptions', label: 'Prescriptions', icon: 'medication' },
                  { key: 'referrals',     label: 'Referrals',     icon: 'send' },
                ] as { key: typeof activeTab; label: string; icon: string }[]).map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      activeTab === tab.key ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <DashboardCard className="p-6 space-y-4 min-h-48">
                {/* Visit History */}
                {activeTab === 'history' && (
                  visits.length > 0 ? (
                    <div className="relative pl-6">
                      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-outline-variant/20" />
                      {visits.map((v, i) => (
                        <div key={i} className="relative mb-8 last:mb-0">
                          <div className="absolute -left-[1.35rem] top-1 w-3 h-3 rounded-full bg-primary border-2 border-white" />
                          <div className="bg-surface-container-low rounded-3xl p-6 space-y-3 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-extrabold text-on-surface text-sm">{v.diagnosis}</p>
                                <p className="text-xs text-on-surface-variant">{v.doctor} · {v.department}</p>
                              </div>
                              <span className="text-[10px] text-on-surface-variant font-semibold bg-surface-container-high px-2 py-1 rounded">{v.date}</span>
                            </div>
                            <p className="text-sm text-on-surface">{v.notes}</p>
                            {v.prescriptions.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {v.prescriptions.map((rx, j) => (
                                  <span key={j} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded font-semibold">
                                    {rx}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-on-surface-variant py-8">No visit history available</p>
                  )
                )}

                {/* Vitals */}
                {activeTab === 'vitals' && (
                  vitals.length > 0 ? (
                    <div className="space-y-4">
                      {vitals.map((v, i) => (
                        <div key={i} className="bg-surface-container-low rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                          <p className="text-[10px] text-on-surface-variant font-semibold mb-3">{new Date(v.recordedAt).toLocaleString()}</p>
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { label: 'Temperature',   value: `${v.temperature}°C`,    icon: 'thermometer' },
                              { label: 'Blood Pressure',value: v.bloodPressure + ' mmHg', icon: 'favorite' },
                              { label: 'Heart Rate',    value: `${v.heartRate} bpm`,    icon: 'monitor_heart' },
                              { label: 'SpO₂',         value: `${v.oxygenSaturation}%`, icon: 'air' },
                              { label: 'Resp. Rate',    value: `${v.respiratoryRate}/min`, icon: 'respiratory_rate' },
                              ...(v.weight ? [{ label: 'Weight', value: `${v.weight} kg`, icon: 'scale' }] : []),
                            ].map(m => (
                              <div key={m.label} className="text-center">
                                <span className="material-symbols-outlined text-primary text-base">{m.icon}</span>
                                <p className="font-extrabold text-on-surface text-sm">{m.value}</p>
                                <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">{m.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-on-surface-variant py-8">No vitals recorded</p>
                  )
                )}

                {/* Prescriptions */}
                {activeTab === 'prescriptions' && (
                  selected.prescriptions && selected.prescriptions.length > 0 ? (
                    <div className="space-y-3">
                      {selected.prescriptions.map(rx => (
                        <div key={rx.id} className="flex items-start gap-4 p-5 bg-surface-container-low rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                          <span className="material-symbols-outlined text-primary text-xl mt-0.5">medication</span>
                          <div className="flex-1">
                            <p className="font-bold text-on-surface">{rx.medicineName} <span className="font-normal text-on-surface-variant">— {rx.dosage}</span></p>
                            <p className="text-xs text-on-surface-variant">{rx.frequency} · {rx.duration}</p>
                            {rx.instructions && <p className="text-xs text-on-surface-variant mt-1 italic">"{rx.instructions}"</p>}
                          </div>
                          <span className="text-[10px] text-on-surface-variant">{rx.prescribedBy}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-on-surface-variant py-8">No prescriptions on record</p>
                  )
                )}

                {/* Referrals */}
                {activeTab === 'referrals' && (
                  selected.referrals && selected.referrals.length > 0 ? (
                    <div className="space-y-3">
                      {selected.referrals.map(ref => (
                        <div key={ref.id} className="p-5 bg-surface-container-low rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-on-surface">→ {ref.toSpecialty}</p>
                              <p className="text-xs text-on-surface-variant">By {ref.referredBy}</p>
                            </div>
                            <StatusChip label={ref.urgency} variant={ref.urgency === 'emergency' ? 'error' : ref.urgency === 'urgent' ? 'warning' : 'neutral'} dot />
                          </div>
                          <p className="text-sm text-on-surface">{ref.reason}</p>
                          <p className="text-[10px] text-on-surface-variant">{new Date(ref.referredAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-on-surface-variant py-8">No referrals on record</p>
                  )
                )}
              </DashboardCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientProfilePage;
