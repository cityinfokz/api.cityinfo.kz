/* eslint-disable */
import * as Knex from 'knex';

export async function up(knex: Knex): Promise<any> {
  return knex.schema.table('telegram_bot_chats', function(t) {
    t.boolean('gross').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<any> {
  return knex.schema.table('telegram_bot_chats', function(t) {
    t.dropColumn('gross');
  });
}
