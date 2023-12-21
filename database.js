const mysql = require('mysql');

const connection = mysql.createConnection({
  host: '34.101.69.28', // IP external Cloud SQL
  user: 'root', // Ganti dengan nama pengguna database
  password: 'admin', // Ganti dengan kata sandi database
  database: 'db_beternakapp', // Ganti dengan nama database
});

function setupDatabase() {
  connection.connect((err) => {
    if (err) {
      console.error('Error connecting to MySQL:', err);
      return;
    }
    console.log('Connected to MySQL');
  });
}

module.exports = { setupDatabase, connection };
