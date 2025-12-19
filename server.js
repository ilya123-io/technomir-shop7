const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Создание таблиц при запуске
pool.query(`
    CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT);
    CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, address TEXT,comment TEXT, items TEXT);
`);

// Регистрация
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        await pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3)', [name, email, password]);
        res.json({ success: true, message: "Вы зарегистрированы!" });
    } catch (err) { res.status(500).json({ success: false, message: "Email уже занят" }); }
});

// Вход
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
        if (result.rows.length > 0) res.json({ success: true, name: result.rows[0].name });
        else res.status(401).json({ success: false, message: "Неверный логин или пароль" });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/order', async (req, res) => {
    const { name, phone, address, comment, items } = req.body; // ← добавили address, comment
    
    try {
        await pool.query(
            'INSERT INTO orders (name, phone, address, comment, items) VALUES ($1, $2, $3, $4, $5)', 
            [name, phone, address, comment, items]
        );
        res.json({ success: true });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ success: false }); 
    }
});

app.listen(process.env.PORT || 3000);