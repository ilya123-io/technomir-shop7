document.addEventListener('DOMContentLoaded', () => {
    
    // ПЕРЕМЕННЫЕ
    let cart = JSON.parse(localStorage.getItem('technoCart')) || [];
    let isRegisterMode = false;

    // Элементы
    const authBtn = document.getElementById('auth-btn');
    const authModal = document.getElementById('auth-modal');
    const closeBtns = document.querySelectorAll('.close');
    const cartCount = document.getElementById('cart-count');
    const cartTableBody = document.getElementById('cart-table-body');
    const cartTotalSum = document.getElementById('cart-total-sum');
    const checkoutPageBtn = document.getElementById('checkout-page-btn');
    const buyModal = document.getElementById('buy-modal');
    const buyForm = document.getElementById('buy-form');

    // Форма входа
    const loginForm = document.getElementById('login-form');
    const authTitle = document.getElementById('auth-title');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const toggleAuthLink = document.getElementById('toggle-auth');
    const nameInput = document.getElementById('reg-name');
    const nameWrap = document.getElementById('name-wrap');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const confirmPasswordWrap = document.getElementById('confirm-password-wrap');

    // 1. ГАЛЕРЕЯ (для карточек товаров)
    const galleryContainer = document.querySelector('.product-gallery-container');
    if (galleryContainer) {
        const mainImage = galleryContainer.querySelector('.main-image-wrapper img');
        const thumbnails = galleryContainer.querySelectorAll('.thumb-box');
        const prevBtn = galleryContainer.querySelector('.carousel-arrow.prev');
        const nextBtn = galleryContainer.querySelector('.carousel-arrow.next');
        let currentIndex = 0;

        function updateGallery(index) {
            if (index < 0) index = thumbnails.length - 1;
            if (index >= thumbnails.length) index = 0;
            currentIndex = index;
            thumbnails.forEach(t => t.classList.remove('active'));
            const activeThumb = thumbnails[currentIndex];
            activeThumb.classList.add('active');
            mainImage.style.opacity = 0;
            setTimeout(() => {
                mainImage.src = activeThumb.querySelector('img').src;
                mainImage.style.opacity = 1;
            }, 200);
        }
        thumbnails.forEach((thumb, index) => {
            thumb.addEventListener('click', () => { updateGallery(index); });
        });
        if (prevBtn && nextBtn) {
            nextBtn.addEventListener('click', () => { updateGallery(currentIndex + 1); });
            prevBtn.addEventListener('click', () => { updateGallery(currentIndex - 1); });
        }
    }

    // 2. АВТОРИЗАЦИЯ
    const activeUserName = localStorage.getItem('activeUserName');
    if (activeUserName) setLoggedInState(activeUserName);
    
    updateCartCounter();

    if (authBtn) {
        authBtn.addEventListener('click', () => {
            if (localStorage.getItem('activeUserName')) {
                if(confirm("Выйти из аккаунта?")) { 
                    localStorage.removeItem('activeUserName');
                    location.reload(); 
                }
            } else if (authModal) { 
                authModal.style.display = 'block'; 
                isRegisterMode = false; 
                updateAuthUI(); 
            }
        });
    }

    if (toggleAuthLink) {
        toggleAuthLink.addEventListener('click', (e) => {
            e.preventDefault(); 
            isRegisterMode = !isRegisterMode; 
            updateAuthUI();
        });
    }

    function updateAuthUI() {
        if (isRegisterMode) {
            authTitle.textContent = "Регистрация"; 
            authSubmitBtn.textContent = "Зарегистрироваться"; 
            toggleAuthLink.textContent = "Уже есть аккаунт? Войти";
            nameWrap.style.display = 'block'; 
            nameInput.required = true;
            confirmPasswordWrap.style.display = 'block'; 
            confirmPasswordInput.required = true;
        } else {
            authTitle.textContent = "Вход"; 
            authSubmitBtn.textContent = "Войти"; 
            toggleAuthLink.textContent = "Нет аккаунта? Регистрация";
            nameWrap.style.display = 'none'; 
            nameInput.required = false;
            confirmPasswordWrap.style.display = 'none'; 
            confirmPasswordInput.required = false;
        }
    }

    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            // --- НОВАЯ ВАЛИДАЦИЯ ---
            if (isRegisterMode) {
                const confirmPassword = confirmPasswordInput.value.trim();

                // Проверка длины пароля
                if (password.length < 6) {
                    alert("⚠️ Пароль слишком короткий! Минимум 6 символов.");
                    return;
                }

                // Проверка совпадения паролей
                if (password !== confirmPassword) {
                    alert("⚠️ Пароли не совпадают! Проверьте ввод.");
                    return;
                }
            }
            // -----------------------

            const url = isRegisterMode ? '/register' : '/login';
            const bodyData = isRegisterMode 
                ? { name: nameInput.value.trim(), email, password } 
                : { email, password };

            try {
                let response = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(bodyData)
                });
                let result = await response.json();
                if (result.success) {
                    if (isRegisterMode) {
                        alert("✅ Регистрация успешна! Теперь войдите.");
                        isRegisterMode = false; 
                        updateAuthUI();
                        // Очистка полей пароля для безопасности
                        passwordInput.value = '';
                        confirmPasswordInput.value = '';
                    } else {
                        localStorage.setItem('activeUserName', result.name);
                        location.reload();
                    }
                } else { 
                    alert("❌ Ошибка: " + result.message); 
                }
            } catch (err) { 
                alert("❌ Ошибка сервера"); 
            }
        });
    }

    function setLoggedInState(name) {
        if(authBtn) {
            authBtn.textContent = 'Выйти'; 
            let greeting = document.getElementById('greeting');
            if (!greeting) {
                greeting = document.createElement('span'); 
                greeting.id = 'greeting';
                greeting.style.marginRight = "10px";
                authBtn.parentNode.insertBefore(greeting, authBtn);
            }
            greeting.textContent = `Привет, ${name}`;
        }
    }

    // 3. КОРЗИНА
    document.querySelectorAll('.add-to-cart-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            let id, name, price, img;

            // Проверяем, где нажата кнопка: в списке или в карточке товара
            const productCard = btn.closest('.product-card');
            const productDetails = btn.closest('.product-details');

            if (productCard) {
                // Если на главной странице
                id = btn.dataset.id;
                name = btn.dataset.name;
                price = parseInt(btn.dataset.price);
                const imgElem = productCard.querySelector('img');
                img = imgElem ? imgElem.src : '';
            } else if (productDetails) {
                // Если на странице товара
                name = productDetails.querySelector('h1').innerText;
                const priceText = productDetails.querySelector('.price').innerText;
                price = parseInt(priceText.replace(/\D/g, ''));
                id = btn.dataset.id || name;
                const mainImg = document.querySelector('.main-image-wrapper img');
                img = mainImg ? mainImg.src : '';
            }

            // Добавляем товар в корзину
            cart.push({ id, name, price, img });
            localStorage.setItem('technoCart', JSON.stringify(cart));
            updateCartCounter();

            // Анимация подтверждения
            const originalText = btn.innerText;
            btn.innerText = "✓ Добавлено";
            btn.style.background = "#28a745";
            setTimeout(() => { 
                btn.innerText = originalText; 
                btn.style.background = ""; 
            }, 1000);
        });
    });

    function updateCartCounter() { 
        if(cartCount) cartCount.innerText = cart.length; 
    }

    if (cartTableBody) renderCartPage();

    function renderCartPage() {
        if (!cartTableBody) return;
        cartTableBody.innerHTML = '';
        let total = 0;
        if (cart.length === 0) {
            cartTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color: #888;">Корзина пуста</td></tr>';
        } else {
            cart.forEach((item, index) => {
                total += item.price;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="text-align:center;">
                        <img src="${item.img}" class="cart-img-preview" alt="${item.name}">
                    </td>
                    <td><span class="cart-item-name">${item.name}</span></td>
                    <td>${item.price.toLocaleString()} руб.</td>
                    <td style="text-align:center;">
                        <button class="btn-remove" onclick="removePageCart(${index})">&times;</button>
                    </td>
                `;
                cartTableBody.appendChild(row);
            });
        }
        if (cartTotalSum) cartTotalSum.innerText = total.toLocaleString() + ' руб.';
    }

    window.removePageCart = function(index) {
        if (confirm("Удалить товар из корзины?")) {
            cart.splice(index, 1);
            localStorage.setItem('technoCart', JSON.stringify(cart));
            updateCartCounter();
            renderCartPage();
        }
    };

    // 4. ОФОРМЛЕНИЕ ЗАКАЗА
    if (checkoutPageBtn) {
        checkoutPageBtn.addEventListener('click', () => {
            if (cart.length === 0) { 
                alert("Корзина пуста! Добавьте товары перед оформлением заказа."); 
                return; 
            }
            if (buyModal) {
                // Заполняем имя пользователя, если он авторизован
                const activeUserName = localStorage.getItem('activeUserName');
                if (activeUserName) {
                    document.getElementById('buy-name').value = activeUserName;
                }
                buyModal.style.display = 'block';
            }
        });
    }

    if (buyForm) {
        buyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('buy-name').value.trim();
            const phone = document.getElementById('buy-phone').value.trim();
            const comment = document.getElementById('buy-comment').value.trim();
            
            // Проверка обязательных полей
            if (!name) {
                alert("Пожалуйста, введите ваше имя!");
                document.getElementById('buy-name').focus();
                return;
            }
            if (!phone) {
                alert("Пожалуйста, введите ваш телефон!");
                document.getElementById('buy-phone').focus();
                return;
            }
            
            // Базовая валидация телефона
            const phoneRegex = /^[\d\s\-\+\(\)]+$/;
            if (!phoneRegex.test(phone)) {
                alert("Пожалуйста, введите корректный номер телефона!");
                document.getElementById('buy-phone').focus();
                return;
            }
            
            // Подготовка данных заказа
            const orderData = {
                name,
                phone,
                comment: comment || "Нет комментария",
                items: JSON.stringify(cart)
            };
            
            console.log("Отправка заказа:", orderData);
            
            try {
                // Показываем индикатор загрузки
                const submitBtn = buyForm.querySelector('.submit-btn');
                const originalText = submitBtn.textContent;
                submitBtn.textContent = "Отправка...";
                submitBtn.disabled = true;
                
                // Отправка на сервер
                let response = await fetch('/order', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(orderData)
                });
                
                let result = await response.json();
                console.log("Ответ сервера:", result);
                
                if (result.success) {
                    alert(`✅ Заказ успешно оформлен! Номер вашего заказа: #${result.orderId || '---'}\nНаш менеджер свяжется с вами в ближайшее время.`);
                    
                    // Очищаем корзину
                    cart = [];
                    localStorage.removeItem('technoCart');
                    
                    // Закрываем модальное окно
                    if (buyModal) buyModal.style.display = 'none';
                    
                    // Сбрасываем форму
                    buyForm.reset();
                    
                    // Обновляем страницу
                    updateCartCounter();
                    if (cartTableBody) renderCartPage();
                    
                    // Показываем сообщение об успехе на странице корзины
                    if (document.querySelector('.cart-page-content')) {
                        cartTableBody.innerHTML = `
                            <tr>
                                <td colspan="4" style="text-align:center; padding: 40px;">
                                    <h3 style="color: #28a745;">✅ Заказ оформлен!</h3>
                                    <p style="color: #ccc; margin: 15px 0;">Спасибо за заказ! Мы скоро свяжемся с вами для подтверждения.</p>
                                    <p style="color: #888; font-size: 0.9em;">Номер заказа: ${result.orderId || '---'}</p>
                                    <a href="index.html" style="color: #007bff; text-decoration: none; display: inline-block; margin-top: 15px;">
                                        ← Вернуться в магазин
                                    </a>
                                </td>
                            </tr>
                        `;
                        document.getElementById('cart-total-sum').textContent = "0 руб.";
                        if (checkoutPageBtn) checkoutPageBtn.style.display = 'none';
                    }
                } else {
                    alert("❌ Ошибка при оформлении заказа: " + (result.message || "Попробуйте еще раз"));
                }
                
            } catch (err) { 
                console.error("Ошибка при отправке заказа:", err);
                alert("❌ Ошибка соединения с сервером. Проверьте интернет-соединение."); 
            } finally {
                // Восстанавливаем кнопку
                const submitBtn = buyForm.querySelector('.submit-btn');
                if (submitBtn) {
                    submitBtn.textContent = originalText || "Оформить заказ";
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // Закрытие модальных окон
    closeBtns.forEach(btn => btn.addEventListener('click', () => {
        if(authModal) authModal.style.display = 'none';
        if(buyModal) buyModal.style.display = 'none';
    }));

    // Закрытие по клику вне окна
    window.addEventListener('click', (e) => {
        if (e.target === authModal) authModal.style.display = 'none';
        if (e.target === buyModal) buyModal.style.display = 'none';
    });

    // Карта Яндекс (если есть на странице)
    if (document.getElementById('map') && typeof ymaps !== 'undefined') {
        ymaps.ready(() => {
            var myMap = new ymaps.Map("map", { 
                center: [55.759082, 37.611171], 
                zoom: 15 
            });
            myMap.geoObjects.add(new ymaps.Placemark([55.759082, 37.611171]));
        });
    }

    // Инициализация при загрузке
    updateCartCounter();
});
