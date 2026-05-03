const mysql = require('mysql2/promise');

async function checkDb() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Ericko098#',
    database: 'afyaflow'
  });

  console.log('--- DOCTORS ---');
  const [doctors] = await connection.execute('SELECT id, name, email FROM doctor');
  console.log(doctors);

  console.log('--- USERS ---');
  const [users] = await connection.execute('SELECT id, username, email FROM user');
  console.log(users);

  console.log('--- APPOINTMENTS ---');
  const [appts] = await connection.execute('SELECT id, doctor_id, patient_id FROM appointment');
  console.log(appts);

  await connection.end();
}

checkDb().catch(console.error);
