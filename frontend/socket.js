// 1. import the socket tool
import { io } from 'socket.io-client'; //io from socket...: this is the client-side version of the library used on the server

// 2. the "phone line" 
const SERVER_URL = "http://192.168.1.8:3000"; // can't use localhost because it's phone-computer connection, need to use computer's IP address so phone knows where to send te "knock" over wifi

// create socket once and export it
const socket = io(SERVER_URL, {
    transports: ['websocket'],
}); // initializes connection; eg. dialing the phone number but not speaking yet

export default socket;