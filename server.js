const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Подключение к PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Проверка подключения к БД
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
    } else {
        console.log('✅ Подключение к базе данных успешно:', res.rows[0].now);
    }
});

// Создание таблиц при запуске
pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, 
        name TEXT, 
        email TEXT UNIQUE, 
        password TEXT
    );
    
    CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY, 
        name TEXT NOT NULL, 
        phone TEXT NOT NULL, 
        comment TEXT DEFAULT '',
        items TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`).then(() => {
    console.log('✅ Таблицы созданы или уже существуют');
}).catch(err => {
    console.error('❌ Ошибка создания таблиц:', err.message);
});

// Регистрация пользователя
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    // Базовая валидация
    if (!name || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: "Все поля обязательны для заполнения" 
        });
    }
    
    try {
        await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)', 
            [name, email, password]
        );
        res.json({ 
            success: true, 
            message: "Вы успешно зарегистрированы!" 
        });
    } catch (err) { 
        if (err.code === '23505') { // Код ошибки дублирования
            res.status(400).json({ 
                success: false, 
                message: "Email уже занят" 
            });
        } else {
            console.error('Ошибка регистрации:', err);
            res.status(500).json({ 
                success: false, 
                message: "Ошибка сервера при регистрации" 
            });
        }
    }
});

// Вход пользователя
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: "Email и пароль обязательны" 
        });
    }
    
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND password = $2', 
            [email, password]
        );
        
        if (result.rows.length > 0) {
            res.json({ 
                success: true, 
                name: result.rows[0].name,
                message: "Вход выполнен успешно"
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: "Неверный email или пароль" 
            });
        }
    } catch (err) { 
        console.error('Ошибка входа:', err);
        res.status(500).json({ 
            success: false, 
            message: "Ошибка сервера при входе" 
        }); 
    }
});

// Оформление заказа
app.post('/order', async (req, res) => {
    const { name, phone, comment = '', items = '[]' } = req.body;
    
    console.log('=== ПОЛУЧЕН НОВЫЙ ЗАКАЗ ===');
    console.log('Имя:', name);
    console.log('Телефон:', phone);
    console.log('Комментарий:', comment);
    console.log('Товары:', items.substring(0, 100) + '...');
    
    // Проверка обязательных полей
    if (!name || !phone) {
        console.log('❌ Отказ: не заполнены обязательные поля');
        return res.status(400).json({ 
            success: false, 
            message: 'Имя и телефон обязательны' 
        });
    }
    
    // Базовая валидация телефона
    if (phone.length < 5) {
        return res.status(400).json({ 
            success: false, 
            message: 'Номер телефона слишком короткий' 
        });
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO orders (name, phone, comment, items) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, created_at`,
            [name.trim(), phone.trim(), comment.trim(), items]
        );
        
        const orderId = result.rows[0].id;
        const createdAt = result.rows[0].created_at;
        
        console.log(`✅ Заказ сохранён! ID: ${orderId}, Дата: ${createdAt}`);
        console.log('=================================');
        
        res.json({ 
            success: true, 
            message: `Заказ №${orderId} успешно оформлен!`,
            orderId: orderId,
            createdAt: createdAt
        });
        
    } catch (err) { 
        console.error('❌ Ошибка сохранения заказа:', err.message);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка при сохранении заказа: ' + err.message 
        }); 
    }
});

// Получение списка заказов (для админки)
app.get('/orders', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, phone, comment, created_at FROM orders ORDER BY id DESC LIMIT 50'
        );
        res.json({ 
            success: true, 
            orders: result.rows,
            count: result.rows.length
        });
    } catch (err) {
        console.error('Ошибка получения заказов:', err);
        res.status(500).json({ 
            success: false, 
            message: err.message 
        });
    }
});

// Получение количества заказов
app.get('/orders/count', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) as count FROM orders');
        res.json({ 
            success: true, 
            count: parseInt(result.rows[0].count)
        });
    } catch (err) {
        console.error('Ошибка подсчета заказов:', err);
        res.status(500).json({ 
            success: false, 
            message: err.message 
        });
    }
});

// Проверка здоровья сервера
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'ТехноМир API'
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`👉 Доступен по адресу: http://localhost:${PORT}`);
});
