const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch'); // Импортируем библиотеку для выполнения HTTP-запросов
const { DateTime } = require('luxon'); // Импортируем DateTime из luxon для работы с датой и временем
const { createCanvas, registerFont } = require('canvas'); // Импортируем createCanvas для создания изображений
const cheerio = require('cheerio'); // Импортируем cheerio для парсинга HTML
const fs = require('fs'); // Импортируем fs для работы с файловой системой

const fontPath = './DejaVuSans.ttf';

if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: 'DejaVuSans' });
} else {
    console.error(`Font file not found at ${fontPath}`);
    // Fallback to a different font or exit the process
    process.exit(1);
}

const telegramToken = '7039136784:AAGcGaj9VbG_O4kSmjPpNuYy3NpVu7Ff3hU';
const chatId = '-1002167888799';
const weatherToken = 'fc01a049e901138a07c480e0657cace0';

const bot = new TelegramBot(telegramToken);

const checkAlertsUrl = 'http://ubilling.net.ua/aerialalerts/?json=true';
const regionToCheck = 'Харківська область'; // Название региона для проверки
const lat = 50.274584; //Золочів Харківська область
const lon = 35.975329; //Золочів Харківська область
const weatherUrl = `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${weatherToken}&units=metric&lang=ua`;
const weatherForecastUrl = `http://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${weatherToken}&units=metric&lang=ua`;

let previousAlertStatus = false; // Хранение предыдущего статуса тревоги
let alertStartTime = null; // Время начала тревоги
let alertEndTime = null; // Время окончания тревоги

function getCurrentTimeInKiev() {
  return DateTime.now().setZone('Europe/Kiev').toFormat('HH:mm:ss dd/MM/yyyy');
}

async function checkAlert() {
  try {
    const response = await fetch(checkAlertsUrl);
    const data = await response.json();
    const states = data.states;

    const alertData = states[regionToCheck];
    const alertStatus = alertData ? alertData.alertnow : false;

    if (alertStatus !== previousAlertStatus) {
      previousAlertStatus = alertStatus;

      if (alertStatus) {
        alertStartTime = getCurrentTimeInKiev();
        const message = `🚨 Увага! Золочів - у харківській області повітряна тривога розпочалася о ${alertStartTime} 😭`;
        await bot.sendMessage(chatId, message);
      } else {
        alertEndTime = getCurrentTimeInKiev();
        const message = `✅ Увага! Золочів - відбій тривоги о ${alertEndTime} 😍`;
        await bot.sendMessage(chatId, message);
      }
    }
  } catch (error) {
    console.error('Помилка при перевірці тривоги:', error);
  }
}

// URL для получения данных о топливе
const fuelUrl = 'https://index.minfin.com.ua/ua/markets/fuel/reg/harkovskaya/';
// URL для получения курса валют
const currencyUrl = 'https://minfin.com.ua/ua/currency/usd/';

// Функция для получения данных о топливе
// Функция для получения данных о топливе
async function fetchFuelPrices() {
    try {
        const response = await fetch(fuelUrl, { headers: { 'Content-Type': 'text/html; charset=utf-8' }}); // Выполняем запрос к URL для получения данных о топливе
        const data = await response.text(); // Получаем текст ответа
        const $ = cheerio.load(data); // Загружаем HTML в cheerio для парсинга

        let headers = [];
        $('#tm-table th').each((i, el) => {
            headers.push($(el).text().trim().replace(/\s+/g, ' ')); // Получаем заголовки таблицы
        });

        let rows = [];
        $('#tm-table tr').each((i, el) => {
            let row = [];
            $(el).find('td').each((j, td) => {
                row.push($(td).text().trim()); // Получаем данные строк таблицы
            });
            if (row.length > 0) {
                // Убедитесь, что данные строки соответствуют порядку
                // Порядок должен быть Оператор, А95+, А95, А92, ДП, Газ
                const reorderedRow = [
                    row[0],  // Оператор
                    row[2],  // А95+ (может быть пустым)
                    row[3],  // А95
                    row[4],  // А92
                    row[5],  // ДП
                    row[6]   // Газ
                ];
                rows.push(reorderedRow); // Добавляем строку в массив
            }
        });

        // Если последняя колонка пуста, удалить её
        if (headers.length > 0 && rows.length > 0 && rows[0].length > headers.length) {
            headers.pop(); // Удаляем последнюю колонку заголовков
            rows = rows.map(row => row.slice(0, -1)); // Удаляем последнюю колонку из всех строк
        }

        return { headers, rows }; // Возвращаем заголовки и строки таблицы
    } catch (error) {
        console.error('Ошибка при получении данных о топливе:', error); // Обрабатываем ошибки
        return { headers: [], rows: [] }; // Возвращаем пустые данные в случае ошибки
    }
}


// Функция для получения курса валют
async function getCurrencyRates() {
    try {
        const response = await fetch(currencyUrl, { headers: { 'Content-Type': 'text/html; charset=utf-8' }}); // Выполняем запрос к URL для получения курса валют
        const body = await response.text(); // Получаем текст ответа
        const $ = cheerio.load(body); // Загружаем HTML в cheerio для парсинга

        const bankRates = [];
        // Извлекаем данные о курсах валют в банках
        $('table.sc-1x32wa2-1.dYkgjk').first().find('tbody tr').each((i, elem) => {
            const currency = $(elem).find('td').first().text().trim(); // Получаем валюту
            const buy = $(elem).find('td').eq(1).text().trim(); // Получаем курс покупки
            const sell = $(elem).find('td').eq(2).text().trim(); // Получаем курс продажи
            const nbu = $(elem).find('td').eq(3).text().trim(); // Получаем курс НБУ
            bankRates.push({ currency, buy, sell, nbu }); // Добавляем данные в массив
        });

        const cashRates = [];
        // Извлекаем данные о готівковом курсе
        $('table.sc-1x32wa2-1.dYkgjk').last().find('tbody tr').each((i, elem) => {
            const currency = $(elem).find('td').first().text().trim(); // Получаем валюту
            const buy = $(elem).find('td').eq(1).text().trim(); // Получаем курс покупки
            const sell = $(elem).find('td').eq(2).text().trim(); // Получаем курс продажи
            cashRates.push({ currency, buy, sell }); // Добавляем данные в массив
        });

        return { bankRates, cashRates }; // Возвращаем данные о курсах валют
    } catch (error) {
        console.error('Ошибка при получении данных о курсе валют:', error); // Обрабатываем ошибки
        return { bankRates: [], cashRates: [] }; // Возвращаем пустые данные в случае ошибки
    }
}

// Определяем размеры и отступы таблицы
const CELL_WIDTH = 150; // Ширина ячейки
const CELL_HEIGHT = 30; // Высота ячейки
const HEADER_HEIGHT = 40; // Высота заголовка
const MARGIN = 20; // Отступ от края страницы
const CANVAS_WIDTH = 940; // Ширина холста
const CANVAS_HEIGHT = 580; // Высота холста

// Функция для создания изображения
async function createImage(fuelData, currencyData) {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    const ctx = canvas.getContext('2d');

    function drawCellText(text, x, y, width, height) {
        ctx.font = '16px "DejaVu Sans"'; // Используем шрифт, поддерживающий кириллицу
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';
        ctx.fillText(text, x + width / 2, y + height / 2);
    }

    function drawTable(headers, rows, x, y) {
        const rowHeight = CELL_HEIGHT;
        const colCount = headers.length;
        const tableWidth = colCount * CELL_WIDTH;

        ctx.font = 'bold 16px "DejaVu Sans"';
        ctx.fillStyle = 'lightgrey';
        ctx.fillRect(x, y, tableWidth, HEADER_HEIGHT);
        ctx.strokeRect(x, y, tableWidth, HEADER_HEIGHT);

        headers.forEach((header, i) => {
            drawCellText(header, x + i * CELL_WIDTH, y, CELL_WIDTH, HEADER_HEIGHT);
            ctx.strokeRect(x + i * CELL_WIDTH, y, CELL_WIDTH, HEADER_HEIGHT);
        });

        ctx.font = '16px "DejaVu Sans"';
        rows.forEach((row, r) => {
            const rowY = y + HEADER_HEIGHT + r * rowHeight;
            ctx.strokeRect(x, rowY, tableWidth, rowHeight);
            row.forEach((cell, c) => {
                drawCellText(cell, x + c * CELL_WIDTH, rowY, CELL_WIDTH, rowHeight);
                ctx.strokeRect(x + c * CELL_WIDTH, rowY, CELL_WIDTH, rowHeight);
            });
        });

        return HEADER_HEIGHT + rows.length * rowHeight;
    }

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    let y = MARGIN;

    ctx.font = 'bold 20px "DejaVu Sans"';
    ctx.fillStyle = 'black';
    ctx.fillText('Таблица с топливом:', MARGIN, y);
    y += MARGIN;

    y += drawTable(fuelData.headers, fuelData.rows, MARGIN, y) + MARGIN;

    ctx.font = 'bold 20px "DejaVu Sans"';
    const course_message = '                                                      Середній курс валют в банках:'
    ctx.fillText(course_message, MARGIN, y);
    y += MARGIN;

    y += drawTable(
        ['Валюта', 'Купівля', 'Продаж', 'Курс НБУ'],
        currencyData.bankRates.map(rate => [rate.currency, rate.buy, rate.sell, rate.nbu]),
        MARGIN,
        y
    ) + MARGIN;

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('report.jpg', buffer);
    return './report.jpg'
}

function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Функция для отправки ежедневного отчета
async function sendDailyReport() {
    try {
        const fuelData = await fetchFuelPrices(); // Получаем данные о топливе
        const currencyData = await getCurrencyRates(); // Получаем данные о курсах валют
        const imagePath = await createImage(fuelData, currencyData); // Создаем изображение отчета
        const message = `
        Рецепт дня🍔, ціна на паливо⛽, курс🤑 на сьогодні: ${getCurrentTimeInKiev()}:
        https://www.povarenok.ru/recipes/show/${getRandomNumber(100000, 140000)}/
        `
        bot.sendMessage(chatId, message)
        bot.sendPhoto(chatId, imagePath)
    } catch (error) {
        console.error('Ошибка при создании и сохранении отчета:', error); // Обрабатываем ошибки
    }
}

setInterval(checkAlert, 1000);

// Отправляем отчет сразу при старте
sendDailyReport().then(() => {
    const now = DateTime.now().setZone('Europe/Kiev'); // Получаем текущее время в Киевском часовом поясе
    const nextRun = now.set({ hour: 8, minute: 0, second: 0 }); // Устанавливаем время следующего запуска на 8:00
    
    let timeToNextRun = nextRun.diff(now).as('milliseconds'); // Рассчитываем разницу во времени до следующего запуска
    if (timeToNextRun < 0) {
        timeToNextRun += 24 * 60 * 60 * 1000; // Если время уже прошло, добавляем 24 часа
    }
    setTimeout(() => {
        sendDailyReport(); // Запускаем отчет
        setInterval(sendDailyReport, 24 * 60 * 60 * 1000); // Запускаем отчет ежедневно
    }, timeToNextRun);
});
