import app from './app';
import { server } from './app';
import { HttpError } from 'http-errors';

const onError = (error: HttpError): void => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = 'Port ' + app.get('port');

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const onListening = (): void => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  console.log('Listening on ' + bind);
};

/**
 * Start Express server.
 */
server.listen(app.get('port'));
server.on('error', onError);
server.on('listening', onListening);

export default server;
