// 1. import the "engines"
const express = require('express'); // pulls blueprints for express framework
const app = express(); // creates an instance of Express app, handles web routes and logic
const http = require('http').createServer(app); // the "wrapping", takes built-in Node "http" module and creates physical server, passes app into it so the server knows to use Express to handle incoming web requests
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // this allows phone to talk to computer
        methods: ["GET", "POST"]
    }
}); // imports socket.io (tool for real-time, two-way communication), andattaches it to "http" server

// 2. set up the "static folder"
app.use(express.static('public')); // tells Express, "if anyoneasks for a file (eg. image, CSS file, or html page), look inside a folder named public". This is howto "serve" the frontend code to the user's browser

// object to store users { "socketID", name: ...,  color: ...}
let activeUsers = {};

// 3. handle live connections
io.on('connection', (socket) => { // an event listener -- waits for user to open the app, and when opened, it triggers a function that gives that specific user a unique "socket" object (their personal "phone line" to the server)
    // io.on('..', (ALWAYS gives socket/ID number))
    // socket.on('..', (ALWAYS gives data, eg. message))
    console.log('A user connected: ' + socket.id); // prints unique ID of person who joined terminal
    
    socket.on('register-user', (profile) => {
        // profile = { name: ..., color: ...}
        activeUsers[socket.id] = { ...profile, id: socket.id };
        io.emit('user-update', Object.values(activeUsers));
    })

    socket.on('unregister-user', () => {
        console.log(`User ${socket.id} is now changing their profile...`);
        // remove them from active list so their name/color is free to be chosen
        delete activeUsers[socket.id];
        // tell everyone they left the lobby for a moment
        io.emit('user-update', Object.values(activeUsers));
    });

    socket.on('disconnect', () => { // another event listener -- waits for user to close their tab orlose internet, then triggers message
        console.log('User disconnected', socket.id);
        delete activeUsers[socket.id];
        // send updated list of users
        io.emit('user-update', Object.values(activeUsers));
    });
});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, '0.0.0.0', () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is running on all interfaces at http://127.0.0.1:${PORT}`); // message to let you know server started successfully without any errors
});