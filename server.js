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

// Создание/проверка таблиц с добавлением недостающих колонок
async function initializeDatabase() {
    try {
        // 1. Создаем таблицу users
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, 
                name TEXT, 
                email TEXT UNIQUE, 
                password TEXT
            )
        `);
        console.log('✅ Таблица users создана/проверена');

        // 2. Создаем таблицу orders (если не существует)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY, 
                name TEXT NOT NULL, 
                phone TEXT NOT NULL,
                items TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица orders создана/проверена');

        // 3. Проверяем и добавляем колонку comment, если её нет
        const checkColumnQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name = 'comment'
        `;
        
        const columnCheck = await pool.query(checkColumnQuery);
        
        if (columnCheck.rows.length === 0) {
            // Колонки comment нет - добавляем её
            await pool.query(`ALTER TABLE orders ADD COLUMN comment TEXT DEFAULT ''`);
            console.log('✅ Колонка comment добавлена в таблицу orders');
        } else {
            console.log('✅ Колонка comment уже существует в таблице orders');
        }

        // 4. Также проверим колонку address (на всякий случай)
        const checkAddressColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            AND column_name = 'address'
        `);
        
        if (checkAddressColumn.rows.length > 0) {
            // Колонка address есть - удалим её, так как мы используем только comment
            await pool.query(`ALTER TABLE orders DROP COLUMN IF EXISTS address`);
            console.log('✅ Колонка address удалена из таблицы orders (используем только comment)');
        }

    } catch (err) {
        console.error('❌ Ошибка инициализации базы данных:', err.message);
    }
}

// Инициализируем базу данных при старте
initializeDatabase();

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

// Оформление заказа (обновленная версия - используем comment вместо address)
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
        // Проверяем структуру таблицы перед вставкой
        const tableInfo = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            ORDER BY ordinal_position
        `);
        
        console.log('Структура таблицы orders:', tableInfo.rows.map(r => r.column_name));
        
        // Вставляем заказ
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
        console.error('Детали ошибки:', err);
        
        // Если ошибка связана с колонкой, попробуем альтернативный запрос
        if (err.message.includes('column "comment"')) {
            try {
                // Пробуем вставить без колонки comment
                console.log('Попытка вставить заказ без колонки comment...');
                const result = await pool.query(
                    `INSERT INTO orders (name, phone, items) 
                     VALUES ($1, $2, $3) 
                     RETURNING id, created_at`,
                    [name.trim(), phone.trim(), items]
                );
                
                const orderId = result.rows[0].id;
                console.log(`✅ Заказ сохранён без комментария! ID: ${orderId}`);
                
                res.json({ 
                    success: true, 
                    message: `Заказ №${orderId} оформлен (комментарий не сохранён)`,
                    orderId: orderId
                });
            } catch (secondErr) {
                res.status(500).json({ 
                    success: false, 
                    message: 'Ошибка базы данных: ' + secondErr.message 
                });
            }
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Ошибка при сохранении заказа: ' + err.message 
            });
        }
    }
});

// Получение списка заказов (для админки)
app.get('/orders', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, phone, 
                   COALESCE(comment, '') as comment, 
                   created_at 
            FROM orders 
            ORDER BY id DESC 
            LIMIT 50
        `);
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

// Получение структуры таблицы orders (для отладки)
app.get('/debug/orders-structure', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'orders' 
            ORDER BY ordinal_position
        `);
        res.json({ 
            success: true, 
            table: 'orders',
            columns: result.rows
        });
    } catch (err) {
        console.error('Ошибка проверки структуры:', err);
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
        service: 'ТехноМир API',
        tables: ['users', 'orders']
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`👉 Доступен по адресу: http://localhost:${PORT}`);
    console.log('📊 Проверка структуры таблиц...');
    
    // Дополнительная проверка при старте
    setTimeout(() => {
        initializeDatabase();
    }, 1000);
});
