/* eslint-disable */
import knex from 'knex';

exports.up = function(knex: knex) {
  return knex.schema.createTable('telegram_bot_chats', function(t) {
    t.integer('city_id').notNullable();
    t.integer('chat_id')
      .unsigned()
      .primary()
      .notNullable();
  });
};

exports.down = function(knex: knex) {
  return knex.schema.dropTable('telegram_bot_chats');
};
