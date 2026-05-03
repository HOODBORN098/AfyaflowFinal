const http = require('http');

http.get('http://localhost:8080/api/patients', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const patients = JSON.parse(data);
      console.log('--- PATIENTS ---');
      patients.forEach(p => console.log(`ID: ${p.id}, Name: ${p.name}, Status: ${p.status}, Dept: ${p.department}`));
    } catch(e) { console.error('Patient parse error:', e); }
  });
});

http.get('http://localhost:8080/api/appointments', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const appts = JSON.parse(data);
      console.log('--- APPOINTMENTS ---');
      appts.forEach(a => console.log(`ID: ${a.id}, Patient: ${a.patient?.name}, Date: ${a.appointmentDate}, Doctor: ${a.doctor?.name}`));
    } catch(e) { console.error('Appointment parse error:', e); }
  });
});
