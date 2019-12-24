/* eslint-disable */
import knex from 'knex';

exports.up = function(knex: knex) {
  return knex.schema.createTable('telegram_bot_requests', function(t) {
    t.increments('id')
      .unsigned()
      .primary();
    t.integer('chat_id', 10).notNullable();
    t.text('request', 'mediumtext').nullable();
    t.dateTime('date').notNullable();
    t.text('message', 'mediumtext');
  });
};

exports.down = function(knex: knex) {
  return knex.schema.dropTable('telegram_bot_requests');
};
