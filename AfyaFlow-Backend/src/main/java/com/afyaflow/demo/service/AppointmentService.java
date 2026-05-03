package com.afyaflow.demo.service;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import com.afyaflow.demo.dto.QueueStats;

import org.springframework.stereotype.Service;

import com.afyaflow.demo.model.Appointment;
import com.afyaflow.demo.model.Doctor;
import com.afyaflow.demo.model.Patient;
import com.afyaflow.demo.repository.AppointmentRepository;
import com.afyaflow.demo.repository.DoctorRepository;
import com.afyaflow.demo.repository.PatientRepository;
import com.afyaflow.demo.repository.UserRepository;

@Service
public class AppointmentService {

    private final AppointmentRepository repository;
    private final DoctorRepository doctorRepository;
    private final PatientRepository patientRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    private static final List<String> ALL_SLOTS = Arrays.asList(
            "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
            "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
            "14:00", "14:30", "15:00", "15:30", "16:00", "16:30");

    public AppointmentService(AppointmentRepository repository,
            DoctorRepository doctorRepository,
            PatientRepository patientRepository,
            NotificationService notificationService,
            UserRepository userRepository) {
        this.repository = repository;
        this.doctorRepository = doctorRepository;
        this.patientRepository = patientRepository;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    /** Legacy: used by the old afyaflow-react frontend */
    @SuppressWarnings("null")
    public Appointment createAppointment(Appointment appointment) {
        return repository.save(appointment);
    }

    public List<Appointment> getAppointments() {
        return repository.findAll();
    }

    public Appointment getAppointment(Long id) {
        if (id == null) return null;
        return repository.findById(id).orElse(null);
    }

    public Appointment confirmAppointment(Long id) {
        if (id == null) throw new IllegalArgumentException("Appointment ID cannot be null");
        Appointment appt = repository.findById(id).orElseThrow();
        appt.setStatus("CONFIRMED");

        // Ensure patient is in queue
        Patient p = appt.getPatient();
        if (p != null) {
            p.setStatus("queued");
            patientRepository.save(p);

            // Create notification for patient
            if (p.getEmail() != null) {
                userRepository.findByEmail(p.getEmail()).ifPresent(user -> {
                    notificationService.createNotification(
                            user,
                            "Appointment Confirmed",
                            "Your appointment for " + appt.getDepartmentName() + " has been confirmed. Your token is "
                                    + p.getPatientCode(),
                            "SUCCESS");
                });
            }
        }

        return repository.save(appt);
    }

    public List<Appointment> getAppointmentsByPatient(Long patientId) {
        return repository.findByPatientId(patientId);
    }

    public List<Appointment> getAppointmentsByDoctor(Long doctorId) {
        return repository.findByDoctorId(doctorId);
    }

    public Doctor getDoctorByEmail(String email) {
        if (email == null) return null;
        return doctorRepository.findByEmail(email).orElse(null);
    }

    /**
     * Returns available time slots for a doctor on a given date.
     * It subtracts already-booked slots from the full slot list.
     */
    public List<String> getAvailableSlots(Long doctorId, String dateStr) {
        LocalDate date = LocalDate.parse(dateStr);
        List<Appointment> existing = repository.findByDoctorId(doctorId)
                .stream()
                .filter(a -> date.equals(a.getAppointmentDate()))
                .collect(Collectors.toList());

        List<String> bookedSlots = existing.stream()
                .map(Appointment::getTimeSlot)
                .collect(Collectors.toList());

        return ALL_SLOTS.stream()
                .filter(slot -> !bookedSlots.contains(slot))
                .collect(Collectors.toList());
    }

    /**
     * Returns available time slots for a department.
     * A slot is available if at least one doctor in the department is free.
     */
    public List<String> getAvailableSlotsByDepartment(Long departmentId, String dateStr) {
        try {
            List<Doctor> doctors = doctorRepository.findByDepartmentId(departmentId);
            if (doctors == null || doctors.isEmpty()) {
                return List.of();
            }

            LocalDate date = LocalDate.parse(dateStr);
            List<Long> doctorIds = doctors.stream()
                    .filter(java.util.Objects::nonNull)
                    .map(Doctor::getId)
                    .collect(Collectors.toList());

            // Better: single query for all appointments
            List<Appointment> allAppointments = repository.findByDoctorIdIn(doctorIds).stream()
                    .filter(a -> a != null && date.equals(a.getAppointmentDate()))
                    .collect(Collectors.toList());

            // A slot is available if (count of appointments in slot) < (number of doctors)
            return ALL_SLOTS.stream()
                    .filter(slot -> {
                        long count = allAppointments.stream()
                                .filter(a -> slot.equals(a.getTimeSlot()))
                                .count();
                        return count < doctors.size();
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

    /**
     * Book an appointment for a patient identified by their email.
     * Creates and persists the appointment as CONFIRMED.
     */
    @SuppressWarnings("null")
    public Appointment bookAppointment(String patientEmail, Long doctorId, Long departmentId, String dateStr,
            String time) {
        Patient patient = patientRepository.findByEmail(patientEmail)
                .orElseGet(() -> {
                    System.out.println(
                            "DEBUG: Patient profile missing for " + patientEmail + ". Creating minimal profile.");
                    Patient p = Patient.builder()
                            .email(patientEmail)
                            .name(patientEmail.split("@")[0])
                            .firstName(patientEmail.split("@")[0])
                            .lastName("Patient")
                            .patientCode(generateTokenId())
                            .status("ACTIVE")
                            .build();
                    return patientRepository.save(p);
                });

        // CRITICAL: Ensure legacy patients also get the new 10-digit token format
        if (patient.getPatientCode() == null || !patient.getPatientCode().startsWith("AFYA-")) {
            patient.setPatientCode(generateTokenId());
            patient = patientRepository.save(patient);
        }

        Doctor assignedDoctor = null;

        if (doctorId != null) {
            assignedDoctor = doctorRepository.findById(doctorId)
                    .orElseThrow(() -> new RuntimeException("Doctor not found: " + doctorId));
        } else if (departmentId != null) {
            // Auto-assign first available doctor in department
            List<Doctor> doctors = doctorRepository.findByDepartmentId(departmentId);
            if (doctors == null || doctors.isEmpty()) {
                throw new RuntimeException("No doctors found in department: " + departmentId);
            }

            LocalDate date = LocalDate.parse(dateStr);

            for (Doctor doc : doctors) {
                if (doc == null)
                    continue;
                List<Appointment> apps = repository.findByDoctorId(doc.getId());
                boolean isBusy = apps != null && apps.stream()
                        .anyMatch(
                                a -> a != null && date.equals(a.getAppointmentDate()) && time.equals(a.getTimeSlot()));

                if (!isBusy) {
                    assignedDoctor = doc;
                    break;
                }
            }
            if (assignedDoctor == null) {
                throw new RuntimeException("No available doctors in department for this slot");
            }
        } else {
            throw new RuntimeException("Either doctorId or departmentId must be provided");
        }

        Appointment appt = Appointment.builder()
                .patient(patient)
                .doctor(assignedDoctor)
                .appointmentDate(LocalDate.parse(dateStr))
                .timeSlot(time)
                .departmentName(assignedDoctor.getDepartment() != null ? assignedDoctor.getDepartment().getName() : "")
                .status("CONFIRMED")
                .type("scheduled")
                .queueNumber(patient.getPatientCode())
                .build();

        try {
            Appointment savedAppt = repository.save(appt);

            // Always put patient in queue when appointment is CONFIRMED
            // Store the assigned doctor name so the doctor's dashboard can filter by it
            patient.setStatus("queued");
            patient.setDepartment(savedAppt.getDepartmentName());
            patient.setAssignedDoctor(assignedDoctor.getName());
            patientRepository.save(patient);

            // Create notification for patient
            if (patient.getEmail() != null) {
                userRepository.findByEmail(patient.getEmail()).ifPresent(user -> {
                    notificationService.createNotification(
                            user,
                            "New Appointment Booked",
                            "You have successfully booked an appointment for " + savedAppt.getDepartmentName() + " on "
                                    + savedAppt.getAppointmentDate(),
                            "INFO");
                });
            }

            return savedAppt;
        } catch (Exception e) {
            System.err.println("CRITICAL ERROR: Failed to save appointment!");
            e.printStackTrace();
            throw e;
        }
    }

    /**
     * Confirms an appointment.
     * Marks status as CONFIRMED and assigns the doctor.
     */
    public boolean confirmAppointment(Long appointmentId, Long doctorId) {
        if (appointmentId == null || doctorId == null) return false;
        Optional<Appointment> optAppt = repository.findById(appointmentId);
        if (optAppt.isPresent()) {
            Appointment appt = optAppt.get();
            Doctor doctor = doctorRepository.findById(doctorId)
                    .orElseThrow(() -> new RuntimeException("Doctor not found"));

            appt.setStatus("CONFIRMED");
            appt.setDoctor(doctor);

            // Ensure patient is in queue for the doctor to see
            Patient p = appt.getPatient();
            if (p != null) {
                p.setStatus("queued");
                patientRepository.save(p);
            }

            repository.save(appt);
            return true;
        }
        return false;
    }

    /**
     * Calculates queue statistics for a specific appointment.
     * Position is determined by the number of CONFIRMED appointments
     * scheduled before this one on the same day for the same doctor.
     */
    public QueueStats getQueueStatus(Long appointmentId, Long doctorId) {
        if (appointmentId == null || doctorId == null) throw new IllegalArgumentException("IDs cannot be null");
        Appointment target = repository.findById(appointmentId)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        List<Appointment> dayAppointments = repository.findByDoctorId(doctorId)
                .stream()
                .filter(a -> a.getAppointmentDate().equals(target.getAppointmentDate()))
                .filter(a -> "CONFIRMED".equals(a.getStatus()) || "IN_PROGRESS".equals(a.getStatus()))
                .sorted((a, b) -> a.getTimeSlot().compareTo(b.getTimeSlot()))
                .collect(Collectors.toList());

        int position = dayAppointments.indexOf(target) + 1;
        int total = dayAppointments.size();

        return QueueStats.builder()
                .userPosition(position)
                .totalInQueue(total)
                .patientsAhead(Math.max(0, position - 1))
                .estimatedWaitTime(Math.max(0, position - 1) * 15) // 15 mins per patient
                .doctorStatus("Available")
                .build();
    }

    private String generateTokenId() {
        // Use a 10-digit random number as requested: AFYA-1407832147
        long randomNum = (long) (Math.random() * 9_000_000_000L) + 1_000_000_000L;
        return "AFYA-" + randomNum;
    }

    @SuppressWarnings("null")
    public Appointment rescheduleAppointment(Long id, String dateStr, String time, String status) {
        if (id == null) return null;
        Appointment appt = repository.findById(id).orElseThrow(() -> new RuntimeException("Appointment not found"));
        if (dateStr != null) appt.setAppointmentDate(LocalDate.parse(dateStr));
        if (time != null) appt.setTimeSlot(time);
        if (status != null) appt.setStatus(status);
        
        Appointment savedAppt = repository.save(appt);

        // Notify user
        Patient p = appt.getPatient();
        if (p != null && p.getEmail() != null) {
            userRepository.findByEmail(p.getEmail()).ifPresent(user -> {
                notificationService.createNotification(
                        user,
                        "Appointment Rescheduled",
                        "Your appointment for " + appt.getDepartmentName() + " has been successfully rescheduled to " + appt.getAppointmentDate() + " at " + appt.getTimeSlot() + ".",
                        "INFO");
            });
        }
        return savedAppt;
    }

    public void cancelAppointment(Long id) {
        if (id == null) return;
        repository.findById(id).ifPresent(appt -> {
            appt.setStatus("cancelled");
            repository.save(appt);

            // If patient exists, update their status too if they were queued
            Patient p = appt.getPatient();
            if (p != null && "queued".equals(p.getStatus())) {
                p.setStatus("admitted"); // Back to admitted or just idle
                patientRepository.save(p);
            }

            // Notify user
            if (p != null && p.getEmail() != null) {
                userRepository.findByEmail(p.getEmail()).ifPresent(user -> {
                    notificationService.createNotification(
                            user,
                            "Appointment Cancelled",
                            "Your appointment for " + appt.getDepartmentName() + " has been successfully cancelled.",
                            "ALERT");
                });
            }
        });
    }
}
