import express, { Request, Response, NextFunction } from 'express';
import Telegraf, { ContextMessageUpdate, Markup } from 'telegraf';
import _ from 'lodash';
import { ApiDB, CityDB } from '../databases';

import {
  ALMATY,
  ALMATY_OPT,
  NUR_SULTAN,
  NUR_SULTAN_OPT,
  PAVLODAR,
  RIDDER,
  UST_KAMENOGORSK,
  UST_KAMENOGORSK_OPT,
} from '../constants/city';
import { QueryBuilder } from 'knex';
import { getDateTimeInterval } from './courses';

interface City {
  id: number;
  gross: number;
}

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
export const router = express.Router();

const USDEmoji = '\u{1F1FA}\u{1F1F8}';
const EUREmoji = '\u{1F1EA}\u{1F1FA}';
const RUBEmoji = '\u{1F1F7}\u{1F1FA}';
const CNYEmoji = '\u{1F1E8}\u{1F1F3}';
const GBPEmoji = '\u{1F1EC}\u{1F1E7}';
const XAUEmoji = '\u{1F4B0}';

const defaultCity: City = {
  id: 4,
  gross: 0,
};

const formatDate = (digit: number): number => {
  if (digit < 10) {
    return +'0' + digit;
  }

  return digit;
};

const checkToken = (req: Request, res: Response, next: NextFunction): void => {
  if (req.params.token !== process.env.TELEGRAM_BOT_TOKEN) {
    res.status(498).json({
      success: false,
      message: 'Failed token',
      token: req.params.token,
    });
  }
  next();
};

const citySelect = (ctx: ContextMessageUpdate): void => {
  const keyboard = [
    [NUR_SULTAN, NUR_SULTAN_OPT],
    [ALMATY, ALMATY_OPT],
    [PAVLODAR, RIDDER],
    [UST_KAMENOGORSK, UST_KAMENOGORSK_OPT],
  ];

  ctx.reply(
    `Привет, ${ctx.message.from.first_name}, для просмотра курса валют в обменных пунктах нужно выбрать город.`,
    Markup.keyboard(keyboard)
      .resize()
      .extra(),
  );
};

router.post(
  '/:token/webhook',
  (req: Request, res: Response, next: NextFunction) => {
    checkToken(req, res, next);
    bot.handleUpdate(req.body, res.json());

    res.status(200).json({
      success: true,
    });
  },
);

const attachChatToCity = (cityName: string, chatId: number): void => {
  const cities: { [key: string]: City } = {
    [NUR_SULTAN]: {
      id: 3,
      gross: 0,
    },
    [NUR_SULTAN_OPT]: {
      id: 3,
      gross: 1,
    },
    [ALMATY]: {
      id: 2,
      gross: 0,
    },
    [ALMATY_OPT]: {
      id: 2,
      gross: 1,
    },
    [PAVLODAR]: {
      id: 1,
      gross: 0,
    },
    [RIDDER]: {
      id: 6,
      gross: 0,
    },
    [UST_KAMENOGORSK]: {
      id: 4,
      gross: 0,
    },
    [UST_KAMENOGORSK_OPT]: {
      id: 4,
      gross: 1,
    },
  };
  const city = cities[cityName];
  ApiDB.raw(
    'INSERT INTO telegram_bot_chats (chat_id,city_id, gross) values (?, ?, ?) ON DUPLICATE KEY UPDATE city_id=?, gross=?',
    [chatId, city.id, city.gross, city.id, city.gross],
  ).catch(error => {
    console.log(error);
  });
};

const currencySelect = (ctx: ContextMessageUpdate): void => {
  attachChatToCity(ctx.message.text, ctx.chat.id);
  const keyboard = [
    [`Продажа${USDEmoji}`, `Покупка${USDEmoji}`],
    [`Продажа${EUREmoji}`, `Покупка${EUREmoji}`],
    [`Продажа${RUBEmoji}`, `Покупка${RUBEmoji}`],
    [`Продажа${CNYEmoji}`, `Покупка${CNYEmoji}`],
    [`Продажа${GBPEmoji}`, `Покупка${GBPEmoji}`],
    /**
     * Не показываем, т.к. нет курсов
     * [`Продажа${XAUEmoji}`, `Покупка${XAUEmoji}`],
     */
    ['Выбор города'],
  ];

  ctx.reply(
    'Выберите валюту',
    Markup.keyboard(keyboard)
      .resize()
      .extra(),
  );
};

/**
 * Get currency field name by request
 * @param text
 */
const getFieldName = (text: string): string => {
  const aliases: { [key: string]: string } = {
    [`Покупка${USDEmoji}`]: 'buyUSD',
    [`Продажа${USDEmoji}`]: 'sellUSD',
    [`Покупка${EUREmoji}`]: 'buyEUR',
    [`Продажа${EUREmoji}`]: 'sellEUR',
    [`Покупка${RUBEmoji}`]: 'buyRUB',
    [`Продажа${RUBEmoji}`]: 'sellRUB',
    [`Покупка${CNYEmoji}`]: 'buyCNY',
    [`Продажа${CNYEmoji}`]: 'sellCNY',
    [`Покупка${GBPEmoji}`]: 'buyGBP',
    [`Продажа${GBPEmoji}`]: 'sellGBP',
    [`Покупка${XAUEmoji}`]: 'buyXAU',
    [`Продажа${XAUEmoji}`]: 'sellXAU',
  };

  return aliases[text];
};

const getUserCity = async (chatId: number): Promise<City> => {
  const rows = await ApiDB.select('city_id as id', 'gross')
    .from('telegram_bot_chats')
    .where({ [`chat_id`]: chatId });

  if (rows.length > 0) {
    return rows[0];
  }

  return defaultCity;
};

const getCityNameById = async (id: number): Promise<string> => {
  const rows = await CityDB.select('name')
    .from('new_exchCityNames')
    .where({ id: id });

  return _.map(rows, 'name')[0];
};

/**
 * Get URL to SITE_URL by cityId
 * @param cityId
 */
const getCityUrlById = (cityId: number): string => {
  const cities: { [key: number]: string } = {
    1: 'pavlodar', // 'Павлодар',
    2: 'almaty', // 'Алматы',
    3: 'astana', // 'Нур-Султан',
    4: 'ust-kamenogorsk', // 'Усть-Каменогорск',
    5: 'ust-kamenogorsk', // 'Усть-Каменогорск Опт',
    6: 'ridder', // 'Риддер',
    7: 'almaty',
    8: 'astana',
  };
  const link = cities[cityId];
  const baseUrl = process.env.SITE_URL + 'exchange/';
  if (link !== undefined) {
    return baseUrl + link + '/';
  }

  return baseUrl;
};
/**
 * Log request data into `telegram_bot_requests` table
 * @param ctx
 * @param field
 * @param cityName
 */
const saveRequest = (
  ctx: ContextMessageUpdate,
  field: string,
  cityName: string,
): void => {
  // сохраняем статистику по запросу
  ApiDB.insert({
    chat_id: ctx.chat.id,
    request: field + ' ' + cityName,
    date: new Date(),
    message: JSON.stringify(ctx.message),
  })
    .into('telegram_bot_requests')
    .catch(error => {
      console.log(error);
    });
};

/**
 * Gets exchange courses
 * @param ctx
 */
const getCourses = async (ctx: ContextMessageUpdate): Promise<void> => {
  const { id: userCityId, gross } = await getUserCity(ctx.chat.id);

  const field = await getFieldName(ctx.message.text);
  const messageText = ctx.message.text;

  if (process.env.NODE_ENV !== 'development') {
    const name = await getCityNameById(userCityId);
    saveRequest(ctx, field, name);
  }

  const { currentDateTime, previousDateTime, hours } = getDateTimeInterval();

  const where = {
    city_id: userCityId,
    hidden: 0,
    published: 1,
    deleted: 0,
    gross: gross ? 1 : 0,
  };
  let order = 'ASC';
  if (field.substr(0, 3) === 'buy') {
    order = 'DESC';
  }
  CityDB.select(field, 'name', 'date_update', 'info', 'phones', 'day_and_night')
    .from('new_exchange_rates')
    .where(where)
    .andWhere(function() {
      (this as QueryBuilder)
        .where('date_update', '>=', currentDateTime)
        .orWhere(function() {
          (this as QueryBuilder)
            .where('date_update', '>=', previousDateTime)
            .andWhere('day_and_night', 1);
        });
    })
    .andWhere(field, '>=', 1)
    .orderBy(field, order)
    .limit(15)
    .then(rows => {
      const responseText =
        '<b>Выгодные курсы</b> обмена валют <b>(ВЫГОДНЫЕ СВЕРХУ)</b>:\n\n\r';
      let responseCoursesText = '';
      for (const rate of rows) {
        // скрываем не круглосуточные пункты в городе Усть-Каменогорск
        if (
          !(
            userCityId === 4 &&
            (hours >= 20 || hours < 8) &&
            !rate.day_and_night
          )
        ) {
          const date = new Date(rate.date_update * 1000);
          const hours = date.getHours();
          const year = date.getFullYear();
          const day = formatDate(date.getDate());
          const month = formatDate(date.getMonth() + 1);
          const minutes = formatDate(date.getMinutes());
          responseCoursesText +=
            `<b>${_.unescape(rate.name)}</b>\n\r` +
            `${messageText} = <b>${rate[field]} KZT</b>\n\r` +
            `<b>Время обновления:</b> ${day}.${month}.${year} ${hours}:${minutes}\n\r`;
          if (rate.phones) {
            responseCoursesText +=
              `<b>Телефоны:</b> ${rate.phones}\n\r` +
              `<b>Адрес:</b> ${rate.info}\n\r`;
          } else {
            responseCoursesText += `<b>Информация:</b> ${rate.info}\n\r`;
          }
          responseCoursesText += '\n\r';
        }
      }
      const url = getCityUrlById(userCityId);
      let replyText: string;
      if (responseCoursesText === '') {
        replyText = 'Нет выгодных курсов по данной валюте.';
      } else {
        replyText =
          responseText +
          responseCoursesText +
          '<b>(ВЫГОДНЫЕ КУРСЫ СВЕРХУ)</b>\n\r';
      }

      ctx.reply('');
      ctx.replyWithHTML(
        replyText,
        Markup.inlineKeyboard([
          Markup.urlButton('Больше обменных пунктов', url),
        ]).extra(),
      );
    });
};

bot.command('start', citySelect);

bot.hears('Выбор города', citySelect);
bot.hears('Начать сначала', citySelect);

bot.hears(UST_KAMENOGORSK, currencySelect);
bot.hears(UST_KAMENOGORSK_OPT, currencySelect);
bot.hears(NUR_SULTAN, currencySelect);
bot.hears(NUR_SULTAN_OPT, currencySelect);
bot.hears(ALMATY, currencySelect);
bot.hears(ALMATY_OPT, currencySelect);
bot.hears(PAVLODAR, currencySelect);
bot.hears(RIDDER, currencySelect);

bot.hears(`Продажа${USDEmoji}`, getCourses);
bot.hears(`Покупка${USDEmoji}`, getCourses);
bot.hears(`Продажа${EUREmoji}`, getCourses);
bot.hears(`Покупка${EUREmoji}`, getCourses);
bot.hears(`Продажа${RUBEmoji}`, getCourses);
bot.hears(`Покупка${RUBEmoji}`, getCourses);
bot.hears(`Продажа${CNYEmoji}`, getCourses);
bot.hears(`Покупка${CNYEmoji}`, getCourses);
bot.hears(`Продажа${GBPEmoji}`, getCourses);
bot.hears(`Покупка${GBPEmoji}`, getCourses);
bot.hears(`Продажа${XAUEmoji}`, getCourses);
bot.hears(`Покупка${XAUEmoji}`, getCourses);
export default router;
