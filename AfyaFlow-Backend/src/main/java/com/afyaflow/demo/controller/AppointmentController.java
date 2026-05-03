package com.afyaflow.demo.controller;

import java.security.Principal;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.afyaflow.demo.dto.BookAppointmentRequest;
import com.afyaflow.demo.dto.QueueStats;
import com.afyaflow.demo.model.Appointment;
import com.afyaflow.demo.service.AppointmentService;

/**
 * =========================================================
 * APPOINTMENT CONTROLLER - Scheduling & Queue Logic
 * =========================================================
 * 
 * PURPOSE:
 *   The core engine for hospital scheduling. Handles the entire
 *   lifecycle of an appointment from initial booking to queue
 *   status tracking and final confirmation by clinical staff.
 * 
 * KEY RESPONSIBILITIES:
 *   - Searching available slots for doctors/departments
 *   - Processing new appointment bookings (Principal-linked)
 *   - Calculating real-time queue positions and wait times
 *   - Managing doctor-patient confirmation handshakes
 * 
 * @author AfyaFlow Development Team
 * @date April 2026
 */
@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentService service;

    public AppointmentController(AppointmentService service){
        this.service = service;
    }

    /** Legacy endpoint used by afyaflow-react */
    @PostMapping("/legacy")
    public Appointment createAppointment(@RequestBody Appointment appointment){
        return service.createAppointment(appointment);
    }

    /** Get all appointments, optionally filtered by patientId or doctorId */
    @GetMapping
    public List<Appointment> getAppointments(
            @RequestParam(required = false) Long patientId,
            @RequestParam(required = false) Long doctorId,
            Principal principal) {
        
        if (principal != null) {
            com.afyaflow.demo.model.Doctor currentDoctor = service.getDoctorByEmail(principal.getName());
            if (currentDoctor != null) {
                return service.getAppointmentsByDoctor(currentDoctor.getId());
            }
        }

        if (patientId != null) {
            return service.getAppointmentsByPatient(patientId);
        } else if (doctorId != null) {
            return service.getAppointmentsByDoctor(doctorId);
        }
        return service.getAppointments();
    }

    /**
     * Returns available time slots for a doctor on a date.
     * Called by the new AfyaFlow-Frontend booking flow.
     * GET /api/appointments/available-slots?doctorId=1&date=2026-04-20
     */
    /**
     * GET AVAILABLE SLOTS
     * Calculates free time slots for a specific doctor or an entire department.
     * Used by the frontend booking calendar to prevent double-booking.
     * @param doctorId Optional: filter by specific doctor
     * @param departmentId Optional: filter by department (auto-assigns doctor later)
     * @param date The date to check (YYYY-MM-DD)
     * @return List of available HH:mm strings
     */
    @GetMapping("/available-slots")
    public List<String> getAvailableSlots(
            @RequestParam(required = false) Long doctorId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam String date) {
        System.out.println("DEBUG: getAvailableSlots called with doctorId=" + doctorId + ", departmentId=" + departmentId + ", date=" + date);
        if (doctorId != null) {
            return service.getAvailableSlots(doctorId, date);
        } else if (departmentId != null) {
            return service.getAvailableSlotsByDepartment(departmentId, date);
        }
        return List.of();
    }

    /**
     * Book an appointment for the currently logged-in patient.
     * Called by the new AfyaFlow-Frontend.
     * POST /api/appointments  { doctorId, departmentId, date, time }
     */
    /**
     * BOOK NEW APPOINTMENT
     * Creates a new appointment for the currently authenticated patient.
     * Links the appointment to the user's Principal (email).
     * @param request Booking details (date, time, doctor/department)
     * @param principal The security principal (logged-in patient)
     * @return The created appointment
     */
    @PostMapping
    public ResponseEntity<Appointment> bookAppointment(
            @RequestBody BookAppointmentRequest request,
            Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        Appointment appt = service.bookAppointment(
            principal.getName(),
            request.getDoctorId(),
            request.getDepartmentId(),
            request.getDate(),
            request.getTime()
        );
        return ResponseEntity.ok(appt);
    }

    /**
     * Confirms an appointment.
     * PUT /api/appointments/{id}/confirm
     */
    @org.springframework.web.bind.annotation.PutMapping("/{id}/confirm")
    public ResponseEntity<Boolean> confirmAppointment(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @RequestBody(required = false) java.util.Map<String, Long> body,
            Principal principal) {
        Long doctorId = body != null ? body.get("doctorId") : null;
        
        if (principal != null) {
            com.afyaflow.demo.model.Doctor currentDoctor = service.getDoctorByEmail(principal.getName());
            if (currentDoctor != null) {
                doctorId = currentDoctor.getId();
            }
        }
        
        if (doctorId == null) {
            return ResponseEntity.badRequest().build();
        }
        
        boolean success = service.confirmAppointment(id, doctorId);
        return ResponseEntity.ok(success);
    }

    @org.springframework.web.bind.annotation.PutMapping("/{id}")
    public ResponseEntity<Appointment> updateAppointment(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        String date = body.get("date");
        String time = body.get("time");
        String status = body.get("status");
        Appointment updated = service.rescheduleAppointment(id, date, time, status);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/{id}/queue-status")
    public ResponseEntity<QueueStats> getQueueStatus(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @RequestParam Long doctorId) {
        QueueStats stats = service.getQueueStatus(id, doctorId);
        return ResponseEntity.ok(stats);
    }

    @org.springframework.web.bind.annotation.PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancelAppointment(@org.springframework.web.bind.annotation.PathVariable Long id) {
        service.cancelAppointment(id);
        return ResponseEntity.noContent().build();
    }
}
