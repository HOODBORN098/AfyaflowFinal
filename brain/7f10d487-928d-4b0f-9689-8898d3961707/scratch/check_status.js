const mysql = require('mysql2/promise');

async function checkDb() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Ericko098#',
    database: 'afyaflow'
  });

  console.log('--- PATIENT STATUS ---');
  const [patients] = await connection.execute('SELECT id, name, status, department, email FROM patient');
  console.log(JSON.stringify(patients, null, 2));

  console.log('\n--- APPOINTMENTS ---');
  const [appts] = await connection.execute('SELECT id, doctor_id, patient_id, status, appointment_date, time_slot, department_name FROM appointment');
  console.log(JSON.stringify(appts, null, 2));

  await connection.end();
}

checkDb().catch(console.error);
