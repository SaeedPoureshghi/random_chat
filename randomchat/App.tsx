/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-native/no-inline-styles */
import React, {useState, useEffect, useRef} from 'react';
import {View, Button, StyleSheet, Text, TextInput} from 'react-native';
import {
  RTCView,
  RTCPeerConnection,
  MediaStream,
  mediaDevices,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import io, {Socket} from 'socket.io-client';

const SignalingServerUrl = 'http://192.168.1.13:3000'; // Replace with your signaling server URL

const App = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [username, setUsername] = useState<string | null>('');

  const [isLogin, setIsLogin] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const SocketRef = useRef<Socket | null>(null);
  const userIdRef = useRef<string | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const configuration = {
    iceServers: [
      {urls: 'stun:stun.l.google.com:19302'},
      {urls: 'stun:stun1.l.google.com:19302'},
      {urls: 'stun:stun2.l.google.com:19302'},
      {urls: 'stun:stun3.l.google.com:19302'},
      {urls: 'stun:stun4.l.google.com:19302'},
    ],
  };

  useEffect(() => {
    if (remoteStream) {
      console.log('remoteStream:', remoteStream);
    }
  }, [remoteStream]);

  useEffect(() => {
    const initWebRTC = async () => {
      const ps = new RTCPeerConnection(configuration);
      peerConnection.current = ps;

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setLocalStream(stream);

      SocketRef.current = io(SignalingServerUrl);

      SocketRef.current?.on('loginSuccess', data => {
        console.log('Login success', data);
        userIdRef.current = data.id;
        setIsLogin(true);
      });

      SocketRef.current?.on('peerFound', data => {
        console.log('Peer found', data);
        setIsSearching(false);
        peerConnection.current
          ?.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true})
          .then(offer => {
            peerConnection.current
              ?.setLocalDescription(offer)
              .then(() => {
                SocketRef.current?.emit('offer', {
                  offer,
                  peerId: data.peerId,
                });
              })
              .catch(err =>
                console.error('Error setting local description:', err),
              );
          })
          .catch(err => console.error('Error creating offer:', err));
      });

      peerConnection.current?.addEventListener('icecandidate', event => {
        if (event.candidate) {
          SocketRef.current?.emit('iceCandidate', {
            candidate: event.candidate,
            senderId: userIdRef.current,
          });
        }
      });

      peerConnection.current?.addEventListener(
        'iceconnectionstatechange',
        () => {
          console.log(
            'iceconnectionstatechange:',
            peerConnection.current?.iceConnectionState,
          );
          if (peerConnection.current?.iceConnectionState === 'connected') {
            console.log('Connected!');
            setRinging(false);
          }
        },
      );

      peerConnection.current?.addEventListener('connectionstatechange', () => {
        console.log(
          'connectionstatechange:',
          peerConnection.current?.connectionState,
        );
        if (peerConnection.current?.connectionState === 'connected') {
          console.log('Connected!');
          setRinging(false);
        }
      });

      peerConnection.current?.addEventListener('track', event => {
        remoteStreamRef.current = event.streams[0];
        setIsConnected(true);
      });

      stream.getTracks().forEach(track => {
        peerConnection.current?.addTrack(track, stream);
      });

      SocketRef.current?.on('iceCandidate', candidate => {
        if (peerConnection.current?.remoteDescription) {
          peerConnection.current
            ?.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(err => console.error('Error adding ice candidate:', err));
        }
      });

      SocketRef.current?.on('offer', async data => {
        console.log('Offer received from', data.senderId);
        peerConnection.current
          ?.setRemoteDescription(new RTCSessionDescription(data.offer))
          .then(() => {
            peerConnection.current
              ?.createAnswer()
              .then(answer => {
                peerConnection.current
                  ?.setLocalDescription(answer)
                  .then(() => {
                    SocketRef.current?.emit('answer', {
                      answer,
                      senderId: data.senderId,
                    });
                  })
                  .catch(err =>
                    console.error('Error setting local description:', err),
                  );
              })
              .catch(err => console.error('Error creating answer:', err));
          })
          .catch(err =>
            console.error('Error setting remote description:', err),
          );
      });
      SocketRef.current?.on('answer', answer => {
        peerConnection.current
          ?.setRemoteDescription(new RTCSessionDescription(answer))
          .catch(err =>
            console.error('Error setting remote description:', err),
          );
      });
    };

    console.log('Initializing WebRTC...');
    initWebRTC();

    return () => {
      console.log('Cleaning up...');
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      SocketRef.current?.disconnect();
    };
  }, []);

  const doLogin = () => {
    SocketRef.current?.emit('login', {name: username, age: 25, country: 'USA'});
  };

  const handleSearch = async () => {
    console.log('Searching...');
    setIsSearching(true);
    SocketRef.current?.emit('searchForPeer', {id: username});
  };

  const handleDisconnect = () => {
    console.log('Disconnecting...');
    setRemoteStream(null);
    setLocalStream(null);
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={{fontSize: 24}}>{username}</Text>
      </View>
      {ringing && <Text style={{fontSize: 24, color: 'red'}}>Ringing...</Text>}
      <View style={styles.upperFrame}>
        {isConnected && (
          <>
            <Text>remoteStream</Text>
            <Text>{remoteStreamRef.current?.toURL()}</Text>
            <RTCView
              streamURL={remoteStreamRef.current?.toURL()}
              style={styles.video}
            />
          </>
        )}
      </View>
      <View style={styles.lowerFrame}>
        {localStream && (
          <>
            <Text>{localStream.toURL()}</Text>
            <RTCView streamURL={localStream.toURL()} style={styles.video} />
          </>
        )}
        {!isLogin && (
          <View style={styles.loginContainer}>
            <TextInput
              style={{borderWidth: 1, marginHorizontal: 10, flex: 1}}
              onChangeText={setUsername}
            />
            <Button title="Login" onPress={doLogin} />
          </View>
        )}
        <View style={styles.buttonsContainer}>
          <Button
            title={isSearching ? 'Searching...' : 'Search'}
            onPress={handleSearch}
            disabled={isSearching}
          />
          <Button
            title="Disconnect"
            onPress={handleDisconnect}
            disabled={!remoteStream}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  upperFrame: {
    flex: 1,
  },
  lowerFrame: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  video: {
    flex: 1,
  },
  loginContainer: {
    flexDirection: 'row',
    margin: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
});

export default App;
