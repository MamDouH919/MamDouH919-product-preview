import { ServiceUnavailableException } from '@nestjs/common';
import { ClientSession, Connection } from 'mongoose';

/** Whether each connection's server can run multi-document transactions. Asked once per connection. */
const transactional = new WeakMap<Connection, Promise<boolean>>();

/**
 * Transactions need a replica-set member (or a sharded cluster's mongos); a
 * standalone `mongod` refuses them. `hello` answers which one this is.
 */
export function supportsTransactions(connection: Connection): Promise<boolean> {
  let known = transactional.get(connection);
  if (!known) {
    known = connection
      .db!.command({ hello: 1 })
      .then((hello) => Boolean(hello.setName) || hello.msg === 'isdbgrid')
      .catch(() => false);
    transactional.set(connection, known);
  }
  return known;
}

/**
 * Runs `fn` as one transaction on `connection` — the request's own tenant
 * connection, never another store's: a session belongs to the client that
 * started it, so it can't be used against a second tenant at all.
 *
 * Mongoose's `connection.transaction` retries on transient errors and an
 * unknown commit result, so `fn` may run more than once. It must only touch
 * the database through `session` and leave side effects (email, logs that
 * claim success) until after this resolves.
 */
export async function withTransaction<T>(
  connection: Connection,
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  if (!(await supportsTransactions(connection))) {
    throw new ServiceUnavailableException(
      "This store's database does not support transactions. It must run as a MongoDB replica set.",
    );
  }
  return connection.transaction(fn, {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  });
}
