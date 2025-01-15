const { Client } = require('pg');
import { DB_PASS } from '@env'

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: DB_PASS,
  port: 5432,
});
client.connect();
client.query('SELECT * FROM songs', (err, res) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(res.rows);
    client.end();
  });