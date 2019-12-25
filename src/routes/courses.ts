import express, { Response } from 'express';
import _ from 'lodash';

const router = express.Router();

import { CityDB } from '../databases';
import { ExpressRequest } from '../index';
import { QueryBuilder } from 'knex';

const checkToken = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Response | void => {
  const token = req.headers['courses-token'];
  if (token !== process.env.COURSES_TOKEN) {
    return res.status(498).json({
      success: false,
      message: 'Failed token',
      token: token ? token : null,
    });
  }
  return next();
};

interface BestCourses {
  [key: string]: number;
}

interface CityBestCourses {
  gross: BestCourses;
  retail: BestCourses;
}

interface Sorting {
  [key: string]: string;
}

interface ExchangeRate {
  id: number;
  name: string;
  buyUSD: number;
  sellUSD: number;
  buyEUR: number;
  sellEUR: number;
  buyRUB: number;
  sellRUB: number;
  buyCNY: number;
  sellCNY: number;
  buyGBP: number;
  info: string;
  phones: string | string[];
  date_update: number;
  day_and_night: number;
  published: number;
  city_id: number;
  gross: boolean;

  [key: string]: number | string | string[] | boolean;
}

// Расчитывает выгодные курсы покупки/продажи
const getBestCourses = (rates: ExchangeRate[]): CityBestCourses => {
  const arrBestRetail: BestCourses = {
    buyUSD: 1,
    buyEUR: 1,
    buyRUB: 1,
    buyCNY: 1,
    buyGBP: 1,
    sellUSD: 10000,
    sellRUB: 10000,
    sellEUR: 10000,
    sellCNY: 10000,
    sellGBP: 10000,
  };
  const arrBestGross = { ...arrBestRetail };
  for (const rate of rates) {
    const best = rate.gross ? arrBestGross : arrBestRetail;
    for (const key in best) {
      // let rateValue = rate[key] as string);
      if (key.substr(0, 3) === 'sel') {
        if (rate[key] <= best[key] && rate[key] > 0) {
          best[key] = rate[key] as number;
        }
      } else if (key.substr(0, 3) === 'buy') {
        if (rate[key] >= best[key] && rate[key] > 0) {
          best[key] = rate[key] as number;
        }
      }
    }
  }

  return {
    retail: arrBestRetail,
    gross: arrBestGross,
  };
};

router.post('*', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Headers', 'courses-token');
  checkToken(req, res, next);
});

router.get('/:cityid/', (req: express.Request, res: express.Response) => {
  const cityId = +req.params.cityid;
  const where: {
    city_id: number;
    hidden: number;
    published: number;
    deleted: number;
  } = {
    city_id: cityId,
    hidden: 0,
    published: 1,
    deleted: 0,
  };

  const sorting: Sorting = {
    buyUSD: 'desc',
    buyEUR: 'desc',
    buyRUB: 'desc',
    buyCNY: 'desc',
    buyGBP: 'desc',
    sellUSD: 'asc',
    sellEUR: 'asc',
    sellRUB: 'asc',
    sellCNY: 'asc',
    sellGBP: 'asc',
  };
  const orderBy = { field: 'date_update', sorting: 'desc' };
  if (sorting[req.query.sortBy]) {
    orderBy.field = req.query.sortBy;
    orderBy.sorting = sorting[req.query.sortBy];
  }
  const date = new Date();
  const hours = date.getHours();
  date.setHours(0, 0, 0, 0);
  const unixTime = Math.round(date.valueOf() / 1000);

  const fields = [
    'id',
    'name',
    'buyUSD',
    'sellUSD',
    'buyEUR',
    'sellEUR',
    'buyRUB',
    'sellRUB',
    'buyCNY',
    'sellCNY',
    'buyGBP',
    'sellGBP',
    'info',
    'phones',
    'date_update',
    'day_and_night',
    'published',
    'longitude',
    'latitude',
    'company_id',
    'gross',
  ];
  CityDB.select(fields)
    .from('new_exchange_rates')
    .where(where)
    .andWhere(function() {
      (this as QueryBuilder)
        .where('date_update', '>=', unixTime)
        .orWhere('day_and_night', 1);
    })
    .orderBy(orderBy.field, orderBy.sorting)
    .then(rows => {
      const rates: ExchangeRate[] = [];
      for (const rate of rows) {
        rate.name = _.unescape(rate.name);
        if (rate.phones) {
          rate.phones = (rate.phones as string)
            .split(',')
            .map(phone => phone.trim());
        }
        // скрываем не круглосуточные пункты в городе Усть-Каменогорск
        if (
          !(cityId === 4 && (hours >= 20 || hours < 8) && !rate.day_and_night)
        ) {
          rates.push(rate);
        }
      }

      // получение выгодных курсов
      const best = getBestCourses(rates);

      return res.status(200).json({ rates: rates, best: best });
    })
    .catch(error => {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: 'Server error, please contact to administrator.',
      });
    });
});

router.post('/update/', (req: ExpressRequest, res: Response) => {
  const missingFields: string[] = [];
  if (req.body) {
    const ExchangeRate: ExchangeRate = req.body;
    const props = Object.keys(ExchangeRate);
    const haystack = [
      'id',
      'name',
      'buyUSD',
      'sellUSD',
      'buyEUR',
      'sellEUR',
      'buyRUB',
      'sellRUB',
      'buyCNY',
      'sellCNY',
      'buyGBP',
      'sellGBP',
      'info',
      'phones',
      'date_update',
      'day_and_night',
      'published',
      'longitude',
      'latitude',
      'company_id',
      'city_id',
      'gross',
    ];

    for (const prop of haystack) {
      if (props.includes(prop) && prop.length > 0) {
      } else {
        missingFields.push(prop);
      }
    }

    if (missingFields.length === 0) {
      if (ExchangeRate['phones']) {
        ExchangeRate['phones'] = (ExchangeRate['phones'] as string)
          .split(',')
          .map(phone => phone.trim());
      }
      req.io.to(`${ExchangeRate['city_id']}`).emit('update', ExchangeRate);

      return res.status(200).json({
        success: true,
      });
    }
  }
  const response: {
    error: string;
    missingFields?: string[];
  } = {
    error: 'All parameters are required',
  };

  if (missingFields.length > 0) {
    response.missingFields = missingFields;
  }

  return res.status(422).json(response);
});

export default router;
