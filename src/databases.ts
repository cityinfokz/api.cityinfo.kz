import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

export const ApiDBConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  },
  migrations: {
    directory: __dirname + '/db/migrations',
    tableName: 'migrations',
  },
};

export const CityDBConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.CITY_DB_HOST,
    database: process.env.CITY_DB_NAME,
    user: process.env.CITY_DB_USER,
    password: process.env.CITY_DB_PASS,
    decimalNumbers: true,
  },
};

export const ApiDB = knex(ApiDBConfig);
export const CityDB = knex(CityDBConfig);
