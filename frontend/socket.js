// "antenna" of project, creates a single, reliable bridge between phone
//  and computer that stays open while navigating betweenscreens

// io from socket...: this is the client-side version of the library used on the server
// contains all the logic required to handle heartbeats (checking if server is still there)
// and auto-reconnection if wifi blips
import { io } from 'socket.io-client'; 

// the "phone line", "handshake" location
// http = protocol, numbers = computer's local IP address, 3000 = port
// can't use localhost because it's phone-computer connection, 
// need to use computer's IP address so phone knows where to send the "knock" over wifi
const SERVER_URL = "http://192.168.1.8:3000"; 

// create socket once and export it
// initializes connection; eg. dialing the phone number but not speaking yet
const socket = io(SERVER_URL, {
    transports: ['websocket'],
}); 
// by default, socket.io tries HTTP Long Polling first (like sending a bunch of letters),
// want to force to 'websocket' from start (it's like a live phone call) since it's faster
// and more stable for real-time maps and chat
// Skips the "handshaking" phase and goes straight to fast connection
// helpful in WSL environmnents where HTTP polling often gets stuck

export default socket;