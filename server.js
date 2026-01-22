// 1. import the "engines"
const express = require('express'); // pulls blueprints for express framework
const app = express(); // creates an instance of Express app, handles web routes and logic
const http = require('http').createServer(app); // the "wrapping", takes built-in Node "http" module and creates physical server, passes app into it so the server knows to use Express to handle incoming web requests
const io = require('socket.io')(http); // imports socket.io (tool for real-time, two-way communication), andattaches it to "http" server

// 2. set up the "static folder"
app.use(express.static('public')); // tells Express, "if anyoneasks for a file (eg. image, CSS file, or html page), look inside a folder named public". This is howto "serve" the frontend code to the user's browser

// 3. handle live connections
io.on('connection', (socket) => { // an event listener -- waits for user to open the app, and when opened, it triggers a function that gives that specific user a unique "socket" object (their personal "phone line" to the server)
    // io.on('..', (ALWAYS gives socket/ID number))
    // socket.on('..', (ALWAYS gives data, eg. message))
    console.log('A friend has connected! ID:', socket.id); // prints unique ID of person who joined terminal

    socket.on('disconnect', () => { // another event listener -- waits for user to close their tab orlose internet, then triggers message
        console.log('A friend disconnected.');
    });
});

// 4. start the server
const PORT = 3000; // think of as "door number" of server
http.listen(PORT, () => { // tells http server (the one wrapping everything) to start listneing for traffic on door 3000
    console.log(`Server is awake! Go to http://localhost:${PORT}`); // message to let you know server started successfully without any errors
});