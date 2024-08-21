const fetch = require('node-fetch');
const TelegramBot = require('node-telegram-bot-api');
const { DateTime } = require('luxon');

const telegramToken = '7039136784:AAGcGaj9VbG_O4kSmjPpNuYy3NpVu7Ff3hU'; // Замените на токен вашего бота
const chatId = '-1002167888799'; // Замените на chat_id вашего чата
const weatherToken = 'fc01a049e901138a07c480e0657cace0'; // Ваш токен OpenWeatherMap

const bot = new TelegramBot(telegramToken);

const checkAlertsUrl = 'http://ubilling.net.ua/aerialalerts/?json=true';
const regionToCheck = 'Харківська область'; // Название региона для проверки
const lat = 50.274584;
const lon = 35.975329;
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

function getWeatherIcon(description) {
  if (description.includes('ясно')) return '☀️';
  if (description.includes('хмарно')) return '☁️';
  if (description.includes('дощ')) return '🌧️';
  if (description.includes('сніг')) return '❄️';
  if (description.includes('гроза')) return '🌩️';
  return '🌤️'; // Іконка за замовчуванням
}

async function getWeather() {
  try {
    const response = await fetch(weatherUrl);
    const data = await response.json();

    const weatherDescription = data.weather[0].description;
    const temperature = data.main.temp;
    const feelsLike = data.main.feels_like;
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;
    const weatherIcon = getWeatherIcon(weatherDescription);

    const message = `
      ${weatherIcon} Погода в Золочеві:
      Опис: ${weatherDescription}
      Температура: ${temperature}°C (відчувається як ${feelsLike}°C)
      Вологість: ${humidity}%
      Швидкість вітру: ${windSpeed} м/с
    `;

    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Помилка при отриманні погоди:', error);
  }
}

async function getWeatherForecast() {
  try {
    const response = await fetch(weatherForecastUrl);
    const data = await response.json();

    if (!data.list) {
      throw new Error('Не вдалося отримати прогноз погоди');
    }

    // Зберігаємо прогнози для сьогодні і завтра
    const today = DateTime.now().setZone('Europe/Kiev').startOf('day');
    const tomorrow = today.plus({ days: 1 });
    const dayAfterTomorrow = today.plus({ days: 2 });

    const forecasts = {};

    data.list.forEach((entry) => {
      const date = DateTime.fromSeconds(entry.dt).setZone('Europe/Kiev');

      if (date >= today && date < dayAfterTomorrow) {
        const dayKey = date.toFormat('dd/MM/yyyy');
        if (!forecasts[dayKey]) {
          forecasts[dayKey] = [];
        }

        forecasts[dayKey].push({
          time: date.toFormat('HH:mm'),
          weatherIcon: getWeatherIcon(entry.weather[0].description),
          weatherDescription: entry.weather[0].description,
          temperature: entry.main.temp,
          feelsLike: entry.main.feels_like,
          humidity: entry.main.humidity,
          windSpeed: entry.wind.speed,
        });
      }
    });

    let message = `🌤️ Прогноз погоди в Золочеві:\n`;
    for (const [day, forecastList] of Object.entries(forecasts)) {
      message += `\n📅 ${day}:\n`;
      forecastList.forEach((forecast) => {
        message += `
          ${forecast.weatherIcon} ${forecast.time}:
          Опис: ${forecast.weatherDescription}
          Температура: ${forecast.temperature}°C (відчувається як ${forecast.feelsLike}°C)
          Вологість: ${forecast.humidity}%
          Швидкість вітру: ${forecast.windSpeed} м/с
        `;
      });
    }

    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Помилка при отриманні прогнозу погоди:', error);
  }
}



function getRandomRecipeUrl() {
  const randomNumber = Math.floor(Math.random() * 147000) + 1; // Рандомний номер від 1 до 147000
  return `https://www.povarenok.ru/recipes/show/${randomNumber}/`;
}

async function sendRandomRecipe() {
  const recipeUrl = getRandomRecipeUrl();
  const message = `🍲 Рецепт: ${recipeUrl}`;
  await bot.sendMessage(chatId, message);
}

// Відправка погоди одразу після запуску для тестування
//getWeather();
getWeatherForecast();

// Відправка рандомного рецепту одразу після запуску
sendRandomRecipe();

const weatherUpdateTimes = [
  { hour: 8, minute: 0 }, // Ранок
  { hour: 14, minute: 0 }, // День
  { hour: 20, minute: 0 }  // Вечір
];

function scheduleWeatherUpdates() {
  weatherUpdateTimes.forEach(time => {
    const now = DateTime.now().setZone('Europe/Kiev');
    let nextUpdate = now.set({ hour: time.hour, minute: time.minute, second: 0 });

    if (now > nextUpdate) {
      nextUpdate = nextUpdate.plus({ days: 1 });
    }

    const delay = nextUpdate.diff(now).as('milliseconds');

    setTimeout(function updateWeather() {
      //getWeather();
      getWeatherForecast();
      setInterval(() => {
        //getWeather();
        getWeatherForecast();
      }, 24 * 60 * 60 * 1000); // Повторять каждые 24 часа
    }, delay);
  });
}

// Відправка рандомного рецепту кожні 2 години
setInterval(sendRandomRecipe, 2 * 60 * 60 * 1000); // 2 години

// Запуск функцій
scheduleWeatherUpdates();
setInterval(checkAlert, 1000);
