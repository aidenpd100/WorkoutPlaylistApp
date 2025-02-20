const express = require('express');
const dotenv = require('dotenv');
const pkg = require('pg');
const { Client } = pkg;
dotenv.config(); 

const app = express();
app.use(express.json()); 

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: process.env.DB_PASS,
  port: 5432,
});

client.connect();

// GET endpoint to get songs
app.get('/songs', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM songs');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// POST endpoint to add a song
app.post('/add-song', async (req, res) => {
  const { id, title, artist, duration, runnability_score } = req.body;

  // Ensure all required fields are present
  if (!id || !title || !artist || !duration || !runnability_score) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Insert the song data into the database
    const result = await client.query(
      'INSERT INTO songs (id, title, artist, duration, runnability_score, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [id, title, artist, duration, runnability_score]
    );

    // Respond with the inserted song
    res.status(201).json({ song: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/song-exists/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await client.query('SELECT EXISTS (SELECT 1 FROM songs WHERE id = $1)', [id]);
    const exists = result.rows[0].exists;
    res.json({ exists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/get-song-data/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await client.query('SELECT runnability_score, duration FROM songs WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      // Song found; return the data
      const { runnability_score, duration } = result.rows[0];
      res.json({ runnabilityScore: runnability_score, duration });
    } else {
      // Song not found
      res.status(404).json({ error: 'Song not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
