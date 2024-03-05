const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Connect to SQLite database
const db = new sqlite3.Database('db.sqlite'); // Replace ':memory:' with the path to your SQLite database file

// Create users table if not exists
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER, country TEXT, socketId TEXT)");
});

// WebSocket connection handling
io.on('connection', socket => {
    console.log('A user connected',socket.id);

    // Event handler for user login
    socket.on('login', ({ name, age, country }) => {
        // Save user details and socketId to the database
        db.run("INSERT INTO users (name, age, country, socketId) VALUES (?, ?, ?, ?)", [name, age, country, socket.id], (error, data) => {
            if (error) {
                console.error('Error saving user to database:', error);
                return;
            }
            console.log('User saved to database:', name, age, country, socket.id);
            socket.emit('loginSuccess', {name, age, country,id: socket.id});
        });

        // Notify the user that they are ready to connect
        // socket.emit('readyToConnect');
    });

    // Event handler for user search
    socket.on('searchForPeer', ({id}) => {
        console.log('User searching for peer sender ', id);
        // Implement logic to find a peer for the user
        // For example, query the database for another user to pair with
        db.get("SELECT * FROM users WHERE name != ? ORDER BY RANDOM() LIMIT 1", [id], (error, peer) => {
            if (error) {
                console.error('Error searching for peer:', error);
                return;
            }
            if (peer) {
                // If a peer is found, notify both users about the connection
                console.log('Peer found in db :', peer.name);
                socket.emit('peerFound', {peerId: peer.socketId, peerName: peer.name, peerAge: peer.age, peerCountry: peer.country});

                // io.to(peer.socketId).emit('peerFound', peer.socketId);
            } else {
                // If no peer is found, notify the user
                socket.emit('noPeerFound');
            }
        });
    });

    // Event handler for ICE candidate message from client
socket.on('iceCandidate', ({ candidate, senderId }) => {
    console.log('Received ICE candidate from sender:', senderId);
    // Find the sender in the database
    db.get("SELECT * FROM users WHERE socketId = ?", [senderId], (error, sender) => {
        if (error) {
            console.error('Error finding sender:', error);
            return;
        }
        if (sender) {
            // If the sender is found, forward the ICE candidate to them
            io.to(sender.socketId).emit('iceCandidate', candidate);
        } else {
            console.log('Sender not found');
        }
    });
});


       // Event handler for offer message
       socket.on('offer', ({ offer, peerId }) => {
        if (!peerId) {
            console.error('No peerId provided');
            return;
        }
        
            
      
        
        // Find the peer in the database
        db.get("SELECT * FROM users WHERE socketId = ?", [peerId], (error, peer) => {
            if (error) {
                console.error('Error finding peer:', error);
                return;
            }
            if (peer) {
                // If the peer is found, forward the offer to them
                console.log('offer send to peer :', peer.socketId,' from :', socket.id);
                io.to(peer.socketId).emit('offer', { offer, senderId: socket.id });
            } else {
                console.log('Peer not found');
            }
        });

});

   


    // Event handler for answer message
socket.on('answer', ({ answer, senderId }) => {
    // Find the sender in the database
    
    db.get("SELECT * FROM users WHERE socketId = ?", [senderId], (error, sender) => {
        if (error) {
            console.error('Error finding sender:', error);
            return;
        }
        if (sender) {
            // If the sender is found, forward the answer to them
            io.to(sender.socketId).emit('answer', answer);
        } else {
            console.log('Sender not found');
        }
    });
});


    // Event handler for disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected');
        // Remove the user's record from the database when they disconnect
        db.run("DELETE FROM users WHERE socketId = ?", [socket.id], error => {
            if (error) {
                console.error('Error removing user from database:', error);
                return;
            }
            console.log('User removed from database:', socket.id);
        });
        // Implement any necessary clean-up logic here
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
