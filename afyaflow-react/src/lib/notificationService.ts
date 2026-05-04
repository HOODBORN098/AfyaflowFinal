/**
 * =========================================================
 * NOTIFICATION SERVICE - Doctor Appointment Alerts
 * =========================================================
 *
 * PURPOSE:
 *   Provides real-time notifications to doctors when new appointments are booked.
 *   Polls the backend for pending/confirmed appointments.
 *   Shows toast alerts when new appointments arrive.
 *   Uses caching to prevent duplicate notifications.
 *
 * HOW IT WORKS:
 *   1. Doctor dashboard calls startDoctorAppointmentMonitoring()
 *   2. Service polls backend every 3 seconds
 *   3. When new appointment detected, callback is triggered
 *   4. Dashboard shows toast notification
 *   5. Polling stops when component unmounts
 *
 * @module NotificationService
 * @author AfyaFlow Development Team
 * @date April 2026
 */

// ========== TYPES & INTERFACES ==========

export interface NewAppointment {
  id: number;
  patientName: string;
  patientId: number;
  department: string;
  appointmentTime: string;
  date: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'in-progress';
  createdAt: string;
}

export interface QueueStats {
  userPosition: number;
  totalInQueue: number;
  estimatedWaitTime: number;
  doctorStatus: string;
  patientsAhead: number;
}

// ========== ACTIVE POLLING SUBSCRIPTIONS ==========
const activePollers: Map<string, ReturnType<typeof setInterval>> = new Map();

// ========== NOTIFICATION CACHE ==========
// Stores appointment IDs that have already triggered a notification.
// Using a Set means each appointment only ever fires ONE toast, no matter
// how many polling cycles elapse afterwards.
const seenAppointmentIds: Set<number> = new Set();

/**
 * START MONITORING DOCTOR APPOINTMENTS
 *
 * FIX: onNewAppointment callback now correctly accepts only one argument (NewAppointment).
 * The second argument (full appointments list) was erroneously passed at the call site in
 * the original code — removed to match the declared type signature used by the dashboard.
 *
 * @param {number} doctorId - The doctor's ID
 * @param {function} onNewAppointment - Callback called once per new unseen appointment
 * @param {number} pollingInterval - Polling frequency in milliseconds (default 3000)
 * @param {function} onUpdate - Optional callback with the full appointments list on every poll
 * @returns {function} Cleanup function to stop polling
 */
export const startDoctorAppointmentMonitoring = (
  doctorId: number,
  onNewAppointment: (appointment: NewAppointment) => void,
  pollingInterval: number = 3000,
  onUpdate?: (appointments: NewAppointment[]) => void
): (() => void) => {
  const pollerId = `doctor-${doctorId}`;

  const pollAppointments = async () => {
    try {
      const token = sessionStorage.getItem('afyaflow_token');
      if (!token) {
        console.warn('No auth token found for doctor appointment monitoring');
        return;
      }

      const response = await fetch(`/api/appointments?doctorId=${doctorId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired — stop polling
          const cleanupFn = activePollers.get(pollerId);
          if (cleanupFn) {
            clearInterval(cleanupFn);
            activePollers.delete(pollerId);
          }
        }
        return;
      }

      // Guard: ensure backend returned JSON, not an HTML error page
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return;
      }

      const rawAppointments: any[] = await response.json();

      const appointments: NewAppointment[] = rawAppointments.map((a) => ({
        id: a.id,
        patientName:
          a.patient?.name ||
          `${a.patient?.firstName || ''} ${a.patient?.lastName || ''}`.trim() ||
          'Patient',
        patientId: a.patient?.id,
        department: a.departmentName,
        appointmentTime: `${a.appointmentDate} ${a.timeSlot || ''}`.trim(),
        date: a.appointmentDate,
        reason: a.patient?.reason || 'Consultation',
        // FIX: backend may return 'in-progress' — include it in the union type above
        status: (a.status?.toLowerCase() || 'pending') as NewAppointment['status'],
        createdAt: a.appointmentDate,
      }));

      // Notify with full list every poll cycle
      if (onUpdate) {
        onUpdate(appointments);
      }

      // ========== CHECK FOR NEW APPOINTMENTS ==========
      // Only fire the toast callback for appointments we have never seen before.
      // Once an ID is in seenAppointmentIds it will never trigger another alert.
      for (const appointment of appointments) {
        if (seenAppointmentIds.has(appointment.id)) continue;
        seenAppointmentIds.add(appointment.id);
        onNewAppointment(appointment);
      }
    } catch (error) {
      console.error('Error polling appointments:', error);
    }
  };

  // Poll immediately, then on interval
  pollAppointments();
  const intervalId = setInterval(pollAppointments, pollingInterval);
  activePollers.set(pollerId, intervalId);

  return () => {
    const id = activePollers.get(pollerId);
    if (id) {
      clearInterval(id);
      activePollers.delete(pollerId);
    }
  };
};

/**
 * GET QUEUE STATUS FOR APPOINTMENT
 */
export const getQueueStatus = async (
  appointmentId: number,
  doctorId: number
): Promise<QueueStats | null> => {
  try {
    const token = sessionStorage.getItem('afyaflow_token');
    if (!token) return null;

    const response = await fetch(
      `/api/appointments/${appointmentId}/queue-status?doctorId=${doctorId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching queue status:', error);
    return null;
  }
};

/**
 * CONFIRM APPOINTMENT
 */
export const confirmAppointment = async (
  appointmentId: number,
  doctorId: number
): Promise<boolean> => {
  try {
    const token = sessionStorage.getItem('afyaflow_token');
    if (!token) return false;

    const response = await fetch(`/api/appointments/${appointmentId}/confirm`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ doctorId, status: 'confirmed' }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error confirming appointment:', error);
    return false;
  }
};

/**
 * SEND NOTIFICATION
 */
export const sendNotification = async (notification: {
  type:
  | 'appointment_booked'
  | 'appointment_confirmed'
  | 'patient_called'
  | 'appointment_completed'
  | 'no_show';
  title: string;
  message: string;
  appointmentId: number;
  doctorId: number;
  patientName: string;
}): Promise<void> => {
  try {
    const token = sessionStorage.getItem('afyaflow_token');
    if (!token) return;

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...notification,
        timestamp: new Date().toISOString(),
        read: false,
      }),
    });

    if (!response.ok) {
      console.warn('Failed to send notification');
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

/**
 * MARK NOTIFICATION AS READ
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const token = sessionStorage.getItem('afyaflow_token');
    if (!token) return;

    await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * STOP ALL ACTIVE POLLING
 */
export const stopAllPolling = (): void => {
  for (const [, intervalId] of activePollers.entries()) {
    clearInterval(intervalId);
  }
  activePollers.clear();
  console.log('All appointment polling stopped');
};

/**
 * CLEAR NOTIFICATION CACHE
 * Call this on logout so the next login session starts fresh.
 */
export const clearNotificationCache = (): void => {
  seenAppointmentIds.clear();
};