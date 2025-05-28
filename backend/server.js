import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import { generateResult } from './services/ai.service.js';

const port = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            callback(null, true); // Allow all origins dynamically
        },
        credentials: true,
    },
    transports: ['websocket', 'polling'],
});


// Authentication middleware for sockets
io.use(async (socket, next) => {
    try {
        // Extract token from auth or headers
        const token =
            socket.handshake.auth?.token ||
            (socket.handshake.headers.authorization
                ? socket.handshake.headers.authorization.split(' ')[1]
                : null);

        const projectId = socket.handshake.query.projectId;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid projectId'));
        }

        socket.project = await projectModel.findById(projectId);
        if (!socket.project) {
            return next(new Error('Project not found'));
        }

        if (!token) {
            return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return next(new Error('Authentication error'));
        }

        socket.user = decoded;

        next();
    } catch (error) {
        next(error);
    }
});

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.roomId = socket.project._id.toString();
    socket.join(socket.roomId);

    socket.on('project-message', async (data) => {
        socket.broadcast.to(socket.roomId).emit('project-message', data);

        const message = data.message;
        if (message.includes('@ai')) {
            const prompt = message.replace('@ai', '');
            const result = await generateResult(prompt);

            io.to(socket.roomId).emit('project-message', {
                message: result,
                sender: { _id: 'ai', email: 'AI' },
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        socket.leave(socket.roomId);
    });
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
