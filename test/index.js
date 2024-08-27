const fetch = require('node-fetch'); // Импортируем библиотеку для выполнения HTTP-запросов
const { DateTime } = require('luxon'); // Импортируем DateTime из luxon для работы с датой и временем
const { createCanvas } = require('canvas'); // Импортируем createCanvas для создания изображений
const cheerio = require('cheerio'); // Импортируем cheerio для парсинга HTML
const fs = require('fs'); // Импортируем fs для работы с файловой системой

// URL для получения данных о топливе
const fuelUrl = 'https://index.minfin.com.ua/ua/markets/fuel/reg/harkovskaya/';
// URL для получения курса валют
const currencyUrl = 'https://minfin.com.ua/ua/currency/usd/';

// Функция для получения данных о топливе
// Функция для получения данных о топливе
async function fetchFuelPrices() {
    try {
        const response = await fetch(fuelUrl); // Выполняем запрос к URL для получения данных о топливе
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
        const response = await fetch(currencyUrl); // Выполняем запрос к URL для получения курса валют
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
const CANVAS_HEIGHT = 1000; // Высота холста

// Функция для создания изображения
async function createImage(fuelData, currencyData) {
    const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT); // Создаем холст
    const ctx = canvas.getContext('2d'); // Получаем контекст рисования

    // Функция для рисования текста в ячейке
    function drawCellText(text, x, y, width, height) {
        ctx.font = '16px Arial'; // Устанавливаем шрифт
        ctx.textAlign = 'center'; // Выравнивание текста по центру
        ctx.textBaseline = 'middle'; // Вертикальное выравнивание по центру
        ctx.fillStyle = 'black'; // Цвет текста
        ctx.fillText(text, x + width / 2, y + height / 2); // Рисуем текст
    }

    // Функция для рисования таблицы
    function drawTable(headers, rows, x, y) {
        const rowHeight = CELL_HEIGHT; // Высота строки
        const colCount = headers.length; // Количество колонок
        const tableWidth = colCount * CELL_WIDTH; // Ширина таблицы

        ctx.font = 'bold 16px Arial'; // Шрифт заголовка
        ctx.fillStyle = 'lightgrey'; // Цвет фона заголовка
        ctx.fillRect(x, y, tableWidth, HEADER_HEIGHT); // Рисуем фон заголовка
        ctx.strokeRect(x, y, tableWidth, HEADER_HEIGHT); // Рисуем рамку заголовка

        headers.forEach((header, i) => {
            drawCellText(header, x + i * CELL_WIDTH, y, CELL_WIDTH, HEADER_HEIGHT); // Рисуем заголовки
                ctx.strokeRect(x + i * CELL_WIDTH, y, CELL_WIDTH, HEADER_HEIGHT); // Рисуем границы ячеек
        });

        ctx.font = '16px Arial'; // Шрифт данных
        rows.forEach((row, r) => {
            const rowY = y + HEADER_HEIGHT + r * rowHeight; // Определяем Y-координату строки
            ctx.strokeRect(x, rowY, tableWidth, rowHeight); // Рисуем границы строки
            row.forEach((cell, c) => {
                drawCellText(cell, x + c * CELL_WIDTH, rowY, CELL_WIDTH, rowHeight); // Рисуем ячейки
                ctx.strokeRect(x + c * CELL_WIDTH, rowY, CELL_WIDTH, rowHeight); // Рисуем границы ячеек
            });
        });

        return HEADER_HEIGHT + rows.length * rowHeight; // Возвращаем высоту таблицы
    }

    ctx.fillStyle = 'white'; // Устанавливаем цвет фона
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // Рисуем фон холста

    let y = MARGIN; // Начальная позиция Y

    ctx.font = 'bold 20px Arial'; // Шрифт заголовков
    ctx.fillStyle = 'black'; // Цвет заголовков
    ctx.fillText('Таблица с топливом:', MARGIN, y); // Рисуем заголовок таблицы топливных цен
    y += MARGIN; // Смещаем Y-координату

    // Рисуем таблицу с ценами на топливо
    y += drawTable(fuelData.headers, fuelData.rows, MARGIN, y) + MARGIN;

    ctx.font = 'bold 20px Arial'; // Шрифт заголовков
    ctx.fillText('                                                      Середній курс валют в банках:', MARGIN, y); // Рисуем заголовок таблицы валют
    y += MARGIN; // Смещаем Y-координату

    // Рисуем таблицу с курсами валют в банках
    y += drawTable(
        ['Валюта', 'Купівля', 'Продаж', 'Курс НБУ'],
        currencyData.bankRates.map(rate => [rate.currency, rate.buy, rate.sell, rate.nbu]),
        MARGIN,
        y
    ) + MARGIN;

    ctx.font = 'bold 20px Arial'; // Шрифт заголовков
    ctx.fillText('                             Готівковий курс:', MARGIN, y); // Рисуем заголовок таблицы готівкового курса
    y += MARGIN; // Смещаем Y-координату

    // Рисуем таблицу с готівковыми курсами
    y += drawTable(
        ['Валюта', 'Купівля', 'Продаж'],
        currencyData.cashRates.map(rate => [rate.currency, rate.buy, rate.sell]),
        MARGIN,
        y
    );

    const path = './report.jpg'; // Путь к файлу отчета
    const out = fs.createWriteStream(path); // Создаем поток для записи файла
    const stream = canvas.createJPEGStream(); // Создаем поток JPEG изображения
    stream.pipe(out); // Записываем изображение в файл

    // Возвращаем промис, который разрешается после завершения записи
    return new Promise((resolve, reject) => {
        out.on('finish', () => resolve(path)); // Успешное завершение записи
        out.on('error', (err) => reject(err)); // Обработка ошибок записи
    });
}

// Функция для отправки ежедневного отчета
async function sendDailyReport() {
    try {
        const fuelData = await fetchFuelPrices(); // Получаем данные о топливе
        const currencyData = await getCurrencyRates(); // Получаем данные о курсах валют
        const imagePath = await createImage(fuelData, currencyData); // Создаем изображение отчета
        console.log(`Отчет сохранен как ${imagePath}`); // Выводим путь к отчету
    } catch (error) {
        console.error('Ошибка при создании и сохранении отчета:', error); // Обрабатываем ошибки
    }
}

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
