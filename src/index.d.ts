import { Request } from 'express';
import { Server } from 'socket.io';

declare interface ExpressRequest extends Request {
  io?: Server;
}
