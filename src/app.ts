import express, { Request, NextFunction, Response } from 'express';
import { createServer, Server } from 'http';
import cors from 'cors';
import createError from 'http-errors';
import dotenv from 'dotenv';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import compression from 'compression';
import helmet from 'helmet';
import socketIO from 'socket.io';

import courses from './routes/courses';
import telegram, { bot } from './routes/telegram';
import { ExpressRequest } from './index';

// initialize configuration
dotenv.config();

const app = express();
// Enable All CORS Requests
app.use(cors());
const server: Server = createServer(app);
const io: socketIO.Server = socketIO(server, {
  origins: process.env.SOCKET_CLIENT_ORIGIN,
  path: '/ws',
});

app.set('port', process.env.PORT);

io.on('connection', socket => {
  socket.on('join', room => {
    socket.join(room);
  });

  socket.on('disconnect', () => {
    console.log('disconnect');
  });
});

app.use((req: ExpressRequest, res: Response, next: NextFunction) => {
  req.io = io;
  next();
});

app.use(
  bot.webhookCallback(
    '/telegram/' + process.env.TELEGRAM_BOT_TOKEN + '/webhook',
  ),
);
bot.telegram.setWebhook(
  process.env.API_URL +
    '/telegram/' +
    process.env.TELEGRAM_BOT_TOKEN +
    '/webhook',
);

app.use(
  bot.webhookCallback(
    '/telegram/' + process.env.TELEGRAM_BOT_TOKEN + '/webhook',
  ),
);

app.use(helmet());
app.use(compression()); //Compress all routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(logger('dev'));
app.use(cookieParser());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to cityinfo.kz api' });
});

app.use('/courses', courses);
app.use('/telegram', telegram);

// catch 404 and forward to error handler
app.use((req, res) => {
  return res.status(404).json(createError(404));
});

// error handler
app.use((err: any, req: Request, res: Response) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500).json(err);
});

export { server };
export default app;
