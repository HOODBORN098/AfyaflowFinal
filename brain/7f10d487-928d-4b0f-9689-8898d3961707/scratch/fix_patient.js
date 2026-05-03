const mysql = require('mysql2/promise');

async function fix() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Ericko098#',
    database: 'afyaflow'
  });

  // Fix Eric Karimi: set status to 'queued' and department to match the appointment
  await connection.execute(
    "UPDATE patient SET status = 'queued', department = 'General' WHERE id = 2"
  );
  console.log('Updated Eric Karimi to queued in General department');

  // Fix appointment date to today
  await connection.execute(
    "UPDATE appointment SET appointment_date = '2026-05-03' WHERE id = 1"
  );
  console.log('Fixed appointment date to today');

  const [patients] = await connection.execute('SELECT id, name, status, department FROM patient WHERE id = 2');
  console.log('Patient after fix:', JSON.stringify(patients, null, 2));

  await connection.end();
}

fix().catch(console.error);
