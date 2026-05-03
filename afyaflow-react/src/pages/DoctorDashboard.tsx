import React, { useState, useEffect } from 'react';
import { useSearch } from '../context/SearchContext';
import DashboardCard from '../components/ui/DashboardCard';
import SignatureButton from '../components/ui/SignatureButton';
import StatusChip from '../components/ui/StatusChip';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import type { Patient } from '../context/DataContext';

import AddPrescriptionModal from '../components/modals/AddPrescriptionModal';
import ReferralModal from '../components/modals/ReferralModal';
import AssignBedModal from '../components/modals/AssignBedModal';
import { startDoctorAppointmentMonitoring, confirmAppointment, type NewAppointment } from '../lib/notificationService';

/**
 * DOCTOR DASHBOARD
 * Primary workspace for clinical staff.
 *
 * CORE FEATURES:
 *   - Real-time Queue Management: Sorted by priority and check-in time.
 *   - Patient Vitals & Records: Quick access to medical history.
 *   - Consultation Actions: Prescriptions, referrals, and bed assignments.
 *   - Live Alerts: Notification service polls for new bookings.
 */

const DoctorDashboard: React.FC = () => {
  const { patients, updatePatientStatus, addPrescription, addReferral, wards, isAssignedToBed } = useData();
  const { searchQuery, setSearchQuery } = useSearch();
  const { user } = useAuth();
  const [search, setSearch] = useState(searchQuery);

  // ========== MODAL STATE ==========
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [isReferring, setIsReferring] = useState(false);
  const [isAssigningBed, setIsAssigningBed] = useState(false);

  // ========== TOAST STATE ==========
  // Declared early so handleConfirmAppointment (defined below) can reference it
  const [markedServed, setMarkedServed] = useState<string[]>([]);
  const [servedNotice, setServedNotice] = useState<string | null>(null);

  // ========== NEW APPOINTMENT MONITORING ==========
  const [appointmentAlert, setAppointmentAlert] = useState<NewAppointment | null>(null);
  const [showAppointmentAlert, setShowAppointmentAlert] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<NewAppointment[]>([]);

  // Sync local search with global search context
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  // ========== START APPOINTMENT MONITORING ==========
  useEffect(() => {
    if (!user?.id) return;
    const doctorId = Number(user.id);
    if (!doctorId) return;

    const handleNewAppointment = (appointment: NewAppointment) => {
      setAppointmentAlert(appointment);
      setShowAppointmentAlert(true);
      setTimeout(() => setShowAppointmentAlert(false), 5000);
    };

    const stopMonitoring = startDoctorAppointmentMonitoring(
      doctorId,
      handleNewAppointment,
      3000,
      (appointments) => setUpcomingAppointments(appointments)
    );

    return () => stopMonitoring();
  }, [user?.id]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setSearchQuery(val);
  };

  // ========== CONFIRM APPOINTMENT ==========
  const handleConfirmAppointment = async (appointmentId: number) => {
    if (!user?.id) return;
    try {
      const doctorId = Number(user.id);
      const success = await confirmAppointment(appointmentId, doctorId);
      if (success) {
        setServedNotice('Appointment confirmed and added to queue');
        setTimeout(() => setServedNotice(null), 3000);
      }
    } catch (error) {
      console.error('Error confirming appointment:', error);
      setServedNotice('Failed to confirm appointment');
      setTimeout(() => setServedNotice(null), 3000);
    }
  };

  const handleDismissAlert = () => {
    setShowAppointmentAlert(false);
    setAppointmentAlert(null);
  };

  // ========== QUEUE LOGIC ==========
  const isAdminOrReceptionist = user?.role === 'Admin' || user?.role === 'Receptionist';
  const queue = patients
    .filter((p) => {
      if (!(p.status === 'queued' || p.status === 'in-progress')) return false;
      // Admin & Receptionist see the full queue
      if (isAdminOrReceptionist) return true;
      // Doctor: if patient has an assigned doctor, match by name
      if (p.assignedDoctor && user?.username) {
        return p.assignedDoctor.toLowerCase() === user.username.toLowerCase();
      }
      // Fallback for walk-in patients (no specific doctor assigned): match by department
      return p.department?.toLowerCase() === user?.department?.toLowerCase();
    })
    .filter(
      (p) =>
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.tokenId.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.status === 'in-progress') return -1;
      if (b.status === 'in-progress') return 1;
      const priorityOrder: Record<string, number> = { emergency: 0, urgent: 1, standard: 2 };
      const aPrio = priorityOrder[a.priority || 'standard'] ?? 2;
      const bPrio = priorityOrder[b.priority || 'standard'] ?? 2;
      if (aPrio !== bPrio) return aPrio - bPrio;
      const aTime = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
      const bTime = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      return aTime - bTime;
    });

  const activePatient: Patient | undefined =
    queue.find((p) => p.status === 'in-progress') || queue[0];

  const handleMarkServed = () => {
    if (!activePatient) return;
    updatePatientStatus(activePatient.id, 'served', { servedAt: new Date().toISOString() });
    setMarkedServed((prev) => [...prev, activePatient.id]);
    setServedNotice(activePatient.name);
    setTimeout(() => setServedNotice(null), 4000);
    const next = queue.find((p) => p.id !== activePatient.id && p.status === 'queued');
    if (next) {
      setTimeout(() => updatePatientStatus(next.id, 'in-progress'), 500);
    }
  };

  const handleNextPatient = () => {
    const next = queue.find((p) => p.status === 'queued');
    if (next) updatePatientStatus(next.id, 'in-progress');
  };

  const servedToday = patients.filter(
    (p) => p.status === 'served' && (!user?.department || user?.role === 'Admin' || user?.role === 'Receptionist' || p.department?.toLowerCase() === user.department.toLowerCase())
  ).length;

  const admissionQueue = patients.filter(
    (p) => p.status === 'admitted' && !isAssignedToBed(p.id)
  );

  const occupiedBeds = wards.flatMap((w) =>
    (w.beds || [])
      .filter((b) => b.status === 'occupied')
      .map((b) => ({ ...b, wardName: w.name, department: w.department }))
  );

  // ========== HELPER: initials from name ==========
  const getInitials = (patient: Patient) =>
    (patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`)
      .trim()
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2) || 'P';

  const getDisplayName = (patient: Patient) =>
    (patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`).trim();

  return (
    <div className="grid grid-cols-12 gap-8">

      {/* ── New Appointment Alert Toast ── */}
      {showAppointmentAlert && appointmentAlert && (
        <div className="fixed top-20 right-6 z-50 bg-secondary text-white px-6 py-4 rounded-2xl shadow-xl shadow-secondary/30 flex items-center gap-4 animate-in slide-in-from-right-5 duration-300">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined animate-pulse">notifications_active</span>
              <p className="font-bold text-sm">New Appointment!</p>
            </div>
            <p className="text-xs opacity-90">
              {appointmentAlert.patientName} • {appointmentAlert.department}
            </p>
            <p className="text-[10px] opacity-80 mt-1">
              {new Date(appointmentAlert.appointmentTime).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleConfirmAppointment(appointmentAlert.id)}
              className="bg-white text-secondary px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-opacity-90 transition-all"
            >
              Confirm
            </button>
            <button
              onClick={handleDismissAlert}
              className="text-white hover:bg-white/20 p-1 rounded transition-all"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Success Toast ── */}
      {servedNotice && (
        <div className="fixed top-20 right-6 z-50 bg-secondary text-white px-5 py-4 rounded-2xl shadow-xl shadow-secondary/30 flex items-center gap-3">
          <span className="material-symbols-outlined">check_circle</span>
          <div>
            <p className="font-bold text-sm">Marked as Served</p>
            <p className="text-xs opacity-90">{servedNotice}</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          LEFT SIDE: Patient Queue
      ══════════════════════════════════════════════ */}
      <section className="col-span-12 lg:col-span-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-primary">Patient Queue</h2>
            <p className="text-sm text-on-surface-variant">
              {queue.length} waiting · {servedToday} {user?.department} served today
            </p>
          </div>
          <SignatureButton
            variant="primary"
            icon="play_arrow"
            className="py-2.5 px-4 text-sm shadow-primary/20"
            onClick={handleNextPatient}
            disabled={!queue.some((p) => p.status === 'queued')}
          >
            Next Patient
          </SignatureButton>
        </div>

        {/* Queue List */}
        <div className="space-y-3">
          {queue.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-lowest rounded-2xl">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant block mb-2">
                check_circle
              </span>
              <p className="text-sm font-bold text-on-surface-variant">Queue is empty</p>
              <p className="text-xs text-on-surface-variant mt-1">
                All {user?.department} patients have been seen
              </p>
            </div>
          ) : (
            queue.map((patient, i) => (
              <div
                key={patient.id}
                className={`p-4 bg-surface-container-lowest rounded-xl shadow-sm border-l-4 transition-colors group cursor-pointer hover:bg-surface-container-low text-on-surface
                  ${patient.status === 'in-progress'
                    ? 'border-primary bg-primary/5'
                    : patient.priority === 'emergency'
                      ? 'border-error'
                      : patient.priority === 'urgent'
                        ? 'border-secondary'
                        : 'border-transparent'}
                  ${markedServed.includes(patient.id) ? 'opacity-50' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                        ${patient.status === 'in-progress'
                          ? 'bg-primary/10 text-primary'
                          : patient.priority === 'emergency'
                            ? 'bg-error-container text-on-error-container'
                            : patient.priority === 'urgent'
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-surface-container-high'}`}
                    >
                      {getInitials(patient)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm">{getDisplayName(patient)}</h4>
                        <span className="text-[9px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded font-mono font-bold">
                          {patient.tokenId}
                        </span>
                        {patient.status === 'in-progress' && (
                          <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                        {patient.priority && patient.priority !== 'standard' ? `${patient.priority.toUpperCase()} • ` : ''}
                        {patient.department} •{' '}
                        {new Date(patient.registeredAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded ${patient.priority === 'emergency'
                        ? 'bg-error-container text-on-error-container'
                        : patient.status === 'in-progress'
                          ? 'bg-primary/10 text-primary'
                          : 'text-on-surface-variant bg-surface-container-high'
                      }`}
                  >
                    #{i + 1}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Efficiency Card */}
        <div className="bg-primary-container p-6 rounded-2xl text-on-primary-container relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-semibold opacity-80 mb-1">Clinic Performance</p>
            <h3 className="text-3xl font-extrabold">
              {queue.length === 0
                ? '100'
                : Math.round((servedToday / (servedToday + queue.length)) * 100)}
              %
            </h3>
            <p className="text-xs mt-2">
              Efficiency rating today. {servedToday} patients served.
            </p>
          </div>
          <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-8xl opacity-10">
            medical_services
          </span>
        </div>

        {/* ── Upcoming Appointments ── */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">event_note</span>
            Upcoming Appointments
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {upcomingAppointments.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic py-4 text-center">
                No upcoming bookings for today.
              </p>
            ) : (
              upcomingAppointments
                .filter((a) => a.status !== 'cancelled')
                .map((appt) => (
                  <div
                    key={appt.id}
                    className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/5 flex justify-between items-center group"
                  >
                    <div>
                      <p className="text-sm font-bold text-on-surface">{appt.patientName}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium">
                        {appt.appointmentTime || 'Scheduled'}
                      </p>
                    </div>

                    {/* FIX: Single clean conditional — no orphaned fragments */}
                    {appt.status === 'in-progress' ? (
                      <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded font-bold uppercase">
                        Active
                      </span>
                    ) : appt.status === 'pending' || appt.status === 'confirmed' ? (
                      <button
                        onClick={() => handleConfirmAppointment(appt.id)}
                        className="opacity-0 group-hover:opacity-100 bg-primary/10 text-primary p-2 rounded-lg transition-all"
                        title="Admit to Queue"
                      >
                        <span className="material-symbols-outlined text-sm">login</span>
                      </button>
                    ) : (
                      <span className="material-symbols-outlined text-secondary text-sm">
                        check_circle
                      </span>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Waitlist Stats */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">bar_chart</span>
            Waitlist Stats
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="font-bold text-on-surface">{user?.department || 'Global'} Queue</span>
              <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {queue.length} waiting
              </span>
            </div>
            <div className="flex justify-between items-center text-sm opacity-60">
              <span className="font-medium text-on-surface">Urgent Cases</span>
              <span className="font-bold text-secondary">
                {queue.filter((p) => p.priority === 'urgent').length}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm opacity-60">
              <span className="font-medium text-on-surface">Emergency Cases</span>
              <span className="font-bold text-error">
                {queue.filter((p) => p.priority === 'emergency').length}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          RIGHT SIDE: Active Consultation
      ══════════════════════════════════════════════ */}
      <section className="col-span-12 lg:col-span-8 space-y-6">
        <DashboardCard className="p-8">
          {activePatient ? (
            <>
              <div className="flex justify-between items-start mb-12">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 border-4 border-surface-container-low flex items-center justify-center font-black text-primary text-2xl">
                      {getInitials(activePatient)}
                    </div>
                    <span className="absolute -bottom-2 -right-2 bg-secondary text-white p-1 rounded-full text-[10px] px-2 font-bold uppercase tracking-widest">
                      {activePatient.status === 'in-progress' ? 'Active' : 'Next'}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl font-black text-primary tracking-tight">
                        {getDisplayName(activePatient)}
                      </h1>
                      <span className="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-xs font-bold">
                        {activePatient.tokenId}
                      </span>
                    </div>
                    <p className="text-on-surface-variant font-medium mt-1">
                      {activePatient.age} Years Old · {activePatient.gender} · {activePatient.department}
                    </p>
                    <div className="flex gap-4 mt-4">
                      <span className="flex items-center gap-1 text-xs text-secondary font-bold cursor-pointer hover:underline">
                        <span className="material-symbols-outlined text-sm">call</span>
                        {activePatient.phone}
                      </span>
                      {activePatient.priority && activePatient.priority !== 'standard' && (
                        <span
                          className={`flex items-center gap-1 text-xs font-bold ${activePatient.priority === 'emergency' ? 'text-error' : 'text-secondary'
                            }`}
                        >
                          <span className="material-symbols-outlined text-sm">priority_high</span>
                          {(activePatient.priority || '').toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <SignatureButton
                    variant="secondary"
                    icon="bed"
                    className="bg-secondary/10 text-secondary border border-secondary/20 shadow-none hover:bg-secondary hover:text-white"
                    onClick={() => setIsAssigningBed(true)}
                    disabled={activePatient.status !== 'in-progress'}
                  >
                    Admit to Ward
                  </SignatureButton>
                  <SignatureButton
                    variant="secondary"
                    icon="check_circle"
                    className="bg-surface-container-low py-3 px-6 shadow-none hover:bg-secondary hover:text-white"
                    onClick={handleMarkServed}
                    disabled={activePatient.status !== 'in-progress'}
                  >
                    Mark as Served
                  </SignatureButton>
                </div>
              </div>

              {/* Chief Complaint */}
              <div className="mb-8 p-4 bg-surface-container-low rounded-xl">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-2">
                  Chief Complaint
                </p>
                <p className="text-sm leading-relaxed text-on-surface-variant italic">
                  "{activePatient.reason}"
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <StatusChip label={(activePatient.department || 'General').toUpperCase()} variant="info" />
                  {activePatient.priority && activePatient.priority !== 'standard' && (
                    <StatusChip
                      label={(activePatient.priority || '').toUpperCase()}
                      variant={activePatient.priority === 'emergency' ? 'error' : ('warning' as any)}
                    />
                  )}
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                {activePatient.vitals && activePatient.vitals.length > 0 ? (
                  (() => {
                    const v = activePatient.vitals[activePatient.vitals.length - 1];
                    const vitalUI = [
                      { label: 'BP (Sys/Dia)', value: v.bloodPressure, unit: 'mmHg', icon: 'monitor_heart' },
                      { label: 'Heart Rate', value: v.heartRate, unit: 'BPM', icon: 'favorite' },
                      { label: 'SpO2', value: v.oxygenSaturation, unit: '%', icon: 'air' },
                      { label: 'Temp', value: v.temperature, unit: '°C', icon: 'thermostat' },
                    ];
                    return vitalUI.map((vital, i) => (
                      <div key={i} className="bg-surface-container-low p-5 rounded-2xl border-b-4 border-secondary">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            {vital.label}
                          </span>
                          <span className="material-symbols-outlined text-secondary">{vital.icon}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-primary tracking-tighter">
                            {vital.value}
                          </span>
                          <span className="text-xs font-bold text-on-surface-variant">{vital.unit}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-secondary">
                          <span className="material-symbols-outlined text-[12px]">check</span>
                          Recorded
                        </div>
                      </div>
                    ));
                  })()
                ) : (
                  <div className="col-span-4 p-8 text-center border-2 border-dashed border-outline-variant/50 rounded-2xl">
                    <p className="text-sm font-bold text-on-surface-variant">No vitals recorded yet.</p>
                  </div>
                )}
              </div>

              {/* Consultation Workspace */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-primary">Consultation Notes</h3>
                  <textarea
                    className="w-full bg-surface-container-low p-4 rounded-xl min-h-[120px] text-sm leading-relaxed text-on-surface-variant border border-outline-variant/10 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                    placeholder="Enter consultation notes, observations, and treatment plan..."
                    defaultValue={activePatient.consultationNotes || ''}
                  />
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-primary">Active Prescriptions</h3>
                  <div className="space-y-2">
                    {activePatient.prescriptions && activePatient.prescriptions.length > 0 ? (
                      activePatient.prescriptions.map((med, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-white border border-outline-variant/20 rounded-lg shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary">medication</span>
                            <div>
                              <p className="text-sm font-bold text-on-surface">{med.medicineName}</p>
                              <p className="text-[10px] text-on-surface-variant font-medium">
                                {med.dosage} • {med.frequency}
                              </p>
                            </div>
                          </div>
                          <span
                            className="material-symbols-outlined text-on-surface-variant text-sm cursor-pointer hover:text-primary transition-colors"
                            title={med.instructions}
                          >
                            info
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-on-surface-variant italic">No prescriptions added.</p>
                    )}
                    <button
                      onClick={() => setIsPrescribing(true)}
                      className="w-full py-2 border-2 border-dashed border-outline-variant rounded-lg text-[10px] font-bold text-on-surface-variant hover:border-primary hover:text-primary transition-all uppercase tracking-widest mt-2"
                    >
                      + Add New Prescription
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-16 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-4xl text-secondary">check_circle</span>
              </div>
              <h3 className="text-2xl font-bold text-on-surface">Queue Complete</h3>
              <p className="text-on-surface-variant">All patients have been seen. Great work today!</p>
              <p className="text-primary font-bold">{servedToday} patients served</p>
            </div>
          )}
        </DashboardCard>

        {/* ── Inpatient & Bed Management ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Admission Queue */}
          <DashboardCard className="p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-primary">Admission Queue</h3>
                <p className="text-xs text-on-surface-variant">Patients awaiting bed assignment</p>
              </div>
              <span className="material-symbols-outlined text-amber-500">hourglass_top</span>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {admissionQueue.length === 0 ? (
                <p className="text-sm text-on-surface-variant italic py-4 text-center bg-surface-container-low rounded-xl">
                  No patients in admission queue.
                </p>
              ) : (
                admissionQueue.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                        {patient.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{patient.name}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase">
                          {patient.department}
                        </p>
                      </div>
                    </div>
                    {/* FIX: Removed alert() — now sets activePatient via queue context */}
                    <p className="text-[10px] text-on-surface-variant italic">
                      Admit patient first to assign bed
                    </p>
                  </div>
                ))
              )}
            </div>
          </DashboardCard>

          {/* Hospital Bed Map */}
          <DashboardCard className="p-6 border-l-4 border-secondary">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-primary">Hospital Bed Map</h3>
                <p className="text-xs text-on-surface-variant">Live occupancy across all wards</p>
              </div>
              <span className="material-symbols-outlined text-secondary">domain</span>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {occupiedBeds.length === 0 ? (
                <p className="text-sm text-on-surface-variant italic py-4 text-center bg-surface-container-low rounded-xl">
                  No beds currently occupied.
                </p>
              ) : (
                occupiedBeds.map((bed) => (
                  <div
                    key={bed.id}
                    className="flex items-center justify-between p-3 bg-white border border-outline-variant/20 rounded-xl shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                        <span className="material-symbols-outlined text-sm">bed</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{bed.patientName}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase">
                          {bed.wardName} · Bed #{bed.bedNumber}
                        </p>
                      </div>
                    </div>
                    <StatusChip label={(bed.department || '').toUpperCase()} variant="neutral" />
                  </div>
                ))
              )}
            </div>
          </DashboardCard>
        </div>

        {/* ── Bottom Layer Activities ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-surface-container-high/50 p-6 rounded-3xl border border-outline-variant/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-primary">
                Lab Results (Pending)
              </h3>
              <span className="material-symbols-outlined text-on-surface-variant">biotech</span>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Serum Creatinine', status: 'Processing' },
                { name: 'Lipid Profile', status: 'Processing' },
              ].map((lab, i) => (
                <div key={i} className="flex justify-between items-center text-xs text-on-surface">
                  <span className="font-medium">{lab.name}</span>
                  <span className="bg-secondary text-white px-2 py-0.5 rounded text-[10px] font-bold">
                    {lab.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="signature-gradient p-6 rounded-3xl text-white relative shadow-xl shadow-primary/20">
            <h3 className="font-bold text-sm uppercase tracking-wider mb-2">Refer Patient</h3>
            <p className="text-xs opacity-90 leading-relaxed mb-4">
              Transfer patient care to another specialized department or request a specialist review.
            </p>
            <button
              onClick={() => setIsReferring(true)}
              disabled={!activePatient}
              className="bg-white text-primary px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all disabled:opacity-50"
            >
              Refer Patient
            </button>
            <span className="material-symbols-outlined absolute top-6 right-6 opacity-20">
              assignment_return
            </span>
          </div>
        </div>
      </section>

      {/* ── FAB: Queue Search ── */}
      <div className="fixed bottom-8 right-8 z-50">
        <div className="group relative">
          <div className="absolute bottom-full right-0 mb-4 scale-0 group-hover:scale-100 transition-all origin-bottom-right">
            <div className="bg-surface-container-high p-4 rounded-2xl shadow-2xl border border-outline-variant/20 w-80">
              <div className="flex items-center gap-2 bg-surface-container-low px-4 py-3 rounded-xl">
                <span className="material-symbols-outlined text-outline text-sm">search</span>
                <input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  autoFocus
                  className="bg-transparent border-none focus:outline-none text-sm w-full placeholder:text-outline"
                  placeholder="Search queue..."
                />
              </div>
            </div>
          </div>
          <button className="signature-gradient w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl shadow-primary/40 hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-3xl">search</span>
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
      {isPrescribing && activePatient && (
        <AddPrescriptionModal
          patientId={activePatient.id}
          doctorName={user?.username || 'Attending Physician'}
          onClose={() => setIsPrescribing(false)}
          onAdd={(rx) => addPrescription(activePatient.id, rx)}
        />
      )}

      {isReferring && activePatient && (
        <ReferralModal
          doctorName={user?.username || 'Attending Physician'}
          onClose={() => setIsReferring(false)}
          onRefer={(ref) => addReferral(activePatient.id, ref)}
        />
      )}

      {isAssigningBed && activePatient && (
        <AssignBedModal
          patientId={activePatient.id}
          patientName={activePatient.name}
          onClose={() => setIsAssigningBed(false)}
          onAssign={() => {
            setServedNotice(`${activePatient.name} admitted to ward`);
            setTimeout(() => setServedNotice(null), 4000);
          }}
        />
      )}
    </div>
  );
};

export default DoctorDashboard;