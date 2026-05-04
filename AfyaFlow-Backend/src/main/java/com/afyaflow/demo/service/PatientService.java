package com.afyaflow.demo.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.afyaflow.demo.dto.PatientDTO;
import com.afyaflow.demo.exception.ResourceNotFoundException;
import com.afyaflow.demo.mapper.PatientMapper;
import com.afyaflow.demo.model.Patient;
import com.afyaflow.demo.repository.PatientRepository;

@Service
@SuppressWarnings("null")
public class PatientService {

    private final PatientRepository patientRepository;
    private final PatientMapper patientMapper;
    private final AuditService auditService;
    private final EmailService emailService;

    public PatientService(PatientRepository patientRepository, PatientMapper patientMapper, AuditService auditService, EmailService emailService) {
        this.patientRepository = patientRepository;
        this.patientMapper = patientMapper;
        this.auditService = auditService;
        this.emailService = emailService;
    }

    public PatientDTO registerPatient(PatientDTO patientDTO) {
        Patient patient = patientMapper.toEntity(patientDTO);
        
        // Generate patientCode (tokenId) if not present
        if (patient.getPatientCode() == null || patient.getPatientCode().isEmpty()) {
            patient.setPatientCode(generateTokenId());
        }
        
        if (patient.getStatus() == null) {
            patient.setStatus("queued"); // Default status
        }

        Patient saved = patientRepository.save(patient);
        
        // Trigger email invitation if email is present for walk-in patients
        if (saved.getEmail() != null && !saved.getEmail().isEmpty()) {
            emailService.sendAccountInvitation(saved.getEmail(), saved.getName());
        }
        
        auditService.log("PATIENT_REGISTERED", "Patient", saved.getId().toString(), 
                "New patient " + saved.getName() + " registered with token " + saved.getPatientCode());
        
        return patientMapper.toDTO(saved);
    }

    public List<PatientDTO> getAllPatients() {
        return patientRepository.findAll().stream()
                .map(patientMapper::toDTO)
                .collect(Collectors.toList());
    }

    public PatientDTO getPatient(Long id) {
        Patient patient = patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with id: " + id));
        return patientMapper.toDTO(patient);
    }

    public PatientDTO getPatientByEmail(String email) {
        Patient patient = patientRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Patient profile not found for email: " + email));
        return patientMapper.toDTO(patient);
    }

    public PatientDTO updatePatientStatus(Long id, String status) {
        Patient patient = patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with id: " + id));
        String oldStatus = patient.getStatus();
        patient.setStatus(status);
        Patient updated = patientRepository.save(patient);
        
        auditService.log("PATIENT_STATUS_UPDATED", "Patient", updated.getId().toString(), 
                "Status changed from " + oldStatus + " to " + status + " for patient " + updated.getName());
        
        return patientMapper.toDTO(updated);
    }

    public PatientDTO updatePatient(Long id, PatientDTO dto) {
        Patient existing = patientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient not found with id: " + id));
        
        // Update fields if present in DTO
        if (dto.getFirstName() != null) existing.setFirstName(dto.getFirstName());
        if (dto.getLastName() != null) existing.setLastName(dto.getLastName());
        if (dto.getFirstName() != null || dto.getLastName() != null) {
            existing.setName((existing.getFirstName() != null ? existing.getFirstName() : "") + " " + 
                             (existing.getLastName() != null ? existing.getLastName() : ""));
        }
        if (dto.getEmail() != null) existing.setEmail(dto.getEmail());
        if (dto.getPhone() != null) existing.setPhone(dto.getPhone());
        if (dto.getAddress() != null) existing.setAddress(dto.getAddress());
        if (dto.getGender() != null) existing.setGender(dto.getGender());
        if (dto.getDob() != null) existing.setDob(dto.getDob());
        if (dto.getVitalsJson() != null) existing.setVitalsJson(dto.getVitalsJson());
        if (dto.getPrescriptionsJson() != null) existing.setPrescriptionsJson(dto.getPrescriptionsJson());
        if (dto.getReferralsJson() != null) existing.setReferralsJson(dto.getReferralsJson());
        if (dto.getConsultationNotes() != null) existing.setConsultationNotes(dto.getConsultationNotes());
        if (dto.getDiagnosis() != null) existing.setDiagnosis(dto.getDiagnosis());
        if (dto.getDepartment() != null) existing.setDepartment(dto.getDepartment());
        if (dto.getAssignedDoctor() != null) existing.setAssignedDoctor(dto.getAssignedDoctor());
        if (dto.getStatus() != null) existing.setStatus(dto.getStatus());
        if (dto.getPriority() != null) existing.setPriority(dto.getPriority());
        
        Patient saved = patientRepository.save(existing);
        auditService.log("PATIENT_PROFILE_UPDATED", "Patient", saved.getId().toString(), 
                "Profile updated for patient " + saved.getName());
        
        return patientMapper.toDTO(saved);
    }

    public void deletePatient(Long id) {
        if (!patientRepository.existsById(id)) {
            throw new ResourceNotFoundException("Patient not found with id: " + id);
        }
        patientRepository.deleteById(id);
    }

    private String generateTokenId() {
        long count = patientRepository.count();
        return String.format("AFY-%03d", count + 1);
    }
}
