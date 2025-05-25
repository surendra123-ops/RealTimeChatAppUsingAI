import socket from 'socket.io-client';

let socketInstance = null;

export const initializeSocket = (projectId) => {
    if (!socketInstance) {
        socketInstance = socket(import.meta.env.VITE_API_URL, {
            auth: {
                token: localStorage.getItem('token')
            },
            query: {
                projectId
            },
            withCredentials: true,  // keep this (needed for cookies)
            autoConnect: true,
            transports: ['websocket', 'polling'] // ADD THIS to avoid xhr poll error fallback issues
        });

        socketInstance.on("connect_error", (err) => {
            console.error("Socket connection error:", err.message);
        });
    }
    return socketInstance;
}

export const receiveMessage = (eventName, cb) => {
    if (socketInstance) {
        socketInstance.on(eventName, cb);
    } else {
        console.error("Socket not initialized. Call initializeSocket() first.");
    }
}

export const sendMessage = (eventName, data) => {
    if (socketInstance) {
        socketInstance.emit(eventName, data);
    } else {
        console.error("Socket not initialized. Call initializeSocket() first.");
    }
}