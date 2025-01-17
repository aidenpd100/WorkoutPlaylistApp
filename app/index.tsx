import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import { Button, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Song from './components/song'; // Ensure the Song component file is properly linked
import InputPage from './pages/input';

WebBrowser.maybeCompleteAuthSession();

// @ts-ignore
import { CLIENT_ID, CLIENT_SECRET } from '@env';

interface Playlist {
  id: string;
  name: string;
}

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  runnabilityScore?: number; // Add runnability score as an optional property
  duration?: string;
}

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const clearTokens = async () => {
  try {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    console.log('Tokens cleared');
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
};

const refreshAccessToken = async () => {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) {
    console.error('Refresh token not found');
    return null;
  }

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', null, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      params: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
    });

    const newAccessToken = response.data.access_token;
    const newRefreshToken = response.data.refresh_token;

    // Save the new tokens
    await AsyncStorage.setItem('accessToken', newAccessToken);
    if (newRefreshToken) {
      await AsyncStorage.setItem('refreshToken', newRefreshToken); // Optional, if Spotify provides a new refresh token
    }

    return newAccessToken;
  } catch (error: any) {
    console.error('Error refreshing access token:', error.response?.data || error.message);
    return null;
  }
};

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState<boolean>(false); // Loading state
  const [progress, setProgress] = useState<number>(0); // Progress state
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID!,
      scopes: ['user-read-email', 'playlist-modify-private', 'user-library-read', 'playlist-read-private'],
      usePKCE: false,
      redirectUri: makeRedirectUri({
        scheme: 'myapp',
      }),
    },
    discovery
  );

  useEffect(() => {
    if (__DEV__) { // Only runs in development mode
      clearTokens();
    }
  }, []);

  useEffect(() => {
    (async () => {
      const storedToken = await AsyncStorage.getItem('accessToken');
      if (storedToken) {
        try {
          // Test the token with a simple API call
          await axios.get('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          setAccessToken(storedToken);
        } catch (error: any) {
          if (error.response?.status === 401) {
            // Token is invalid or expired
            const newToken = await refreshAccessToken();
            if (newToken) {
              setAccessToken(newToken);
            }
          }
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;

      axios
        .post('https://accounts.spotify.com/api/token', null, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          params: {
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: makeRedirectUri({
              scheme: 'myapp',
            }),
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
          },
        })
        .then((response) => {
          const token = response.data.access_token;
          const refreshToken = response.data.refresh_token;
          setAccessToken(token);

          AsyncStorage.setItem('accessToken', token).catch((err) =>
            console.error('Error saving access token:', err)
          );

          AsyncStorage.setItem('refreshToken', refreshToken).catch((err) =>
            console.error('Error saving refresh token:', err)
          );
        })
        .catch((error) => {
          console.error('Error exchanging code for token:', error.response?.data || error.message);
        });
    }
  }, [response]);

  useEffect(() => {
    if (accessToken) {
      setLoading(true); // Start loading
      axios
        .get('https://api.spotify.com/v1/me/playlists', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .then(async (response) => {
          const playlists: Playlist[] = response.data.items;
          const allTracksFetched: Track[] = [];
          const seenTracks = new Set();
  
          const trackPromises = playlists.map((playlist, index) =>
            axios
              .get(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              })
              .then(async (trackResponse) => {
                const tracks = trackResponse.data.items.map((item: { track: Track }) => item.track);
                const totalTracks = tracks.length;
  
                for (let i = 0; i < totalTracks; i++) {
                  const track = tracks[i];
                  if (!seenTracks.has(track.id)) {
                    seenTracks.add(track.id);
  
                    try {
                      const pythonApiUrl = 'http://10.203.100.230:8000/analyze-song/';
                      const runnabilityResponse = await axios.post(pythonApiUrl, {
                        artist: track.artists[0].name,
                        title: track.name
                      });
                      const runnabilityScore = runnabilityResponse.data.runability_score;
                      const duration = runnabilityResponse.data.duration;
  
                      allTracksFetched.push({ ...track, runnabilityScore, duration });
                      setProgress((prevProgress) => prevProgress + 1);
                    } catch (error) {
                      console.error(`Error fetching runnability score for ${track.name}:`, error);
                    }
                  }
                }
              })
              .catch((error) => {
                console.error(`Error fetching tracks for playlist ${playlist.name}:`, error.response?.data || error.message);
              })
          );
  
          await Promise.all(trackPromises);
          
          // Sort tracks by runnabilityScore in descending order
          allTracksFetched.sort((a, b) => (b.runnabilityScore || 0) - (a.runnabilityScore || 0));
  
          setAllTracks(allTracksFetched);
          setLoading(false); // Stop loading when all songs are loaded
        })
        .catch((error) => {
          console.error('Error fetching playlists:', error.response?.data || error.message);
        });
    }
  }, [accessToken]);
  

  const renderItem = ({ item }: { item: Track }) => {
    if (item.duration !== "Unknown") {
      return <Song item={item} runnabilityScore={item.runnabilityScore} duration={item.duration || undefined} />;
    } else {
      return null; // Do not render the item if the score is undefined
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        {/* <Button title="Clear Tokens" onPress={clearTokens} /> */}
        {!accessToken ? (
          // If no access token, display the login button
          <View style={styles.centeredContainer}>
            <Button title="Login with Spotify" onPress={() => promptAsync()} />
          </View>
        ) : loading ? (
          <View style={styles.centeredContainer}>
            <ActivityIndicator size="large" color="#1DB954" />
            <Text>Loading songs...</Text>
            <View style={styles.progressContainer}>
              <Text>{progress} tracks loaded</Text>
            </View>
          </View>
        ) : (
          <InputPage allTracks={allTracks} renderItem={renderItem} playlistStyles={styles} accessToken={accessToken}/>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  songListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    marginTop: 10,
  },
});

