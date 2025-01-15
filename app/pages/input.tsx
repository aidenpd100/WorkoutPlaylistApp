import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert, FlatList, Modal } from "react-native";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";

const PlaylistModal = ({ isVisible, setIsVisible, playlistName, setPlaylistName, playlistDescription, setPlaylistDescription, createPlaylist } : {isVisible: any, setIsVisible: any, playlistName: any, setPlaylistName: any, playlistDescription: any, setPlaylistDescription: any, createPlaylist: any}) => ( 
  <Modal
    visible={isVisible}
    animationType="slide"
    transparent={true}
    onRequestClose={() => setIsVisible(false)}
  >
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <View style={{ width: 300, backgroundColor: 'green', padding: 20, borderRadius: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Customize Playlist</Text>
        <TextInput
          placeholder="Playlist Name"
          value={playlistName}
          onChangeText={setPlaylistName}
          style={{
            borderWidth: 1,
            borderColor: 'gray',
            borderRadius: 5,
            marginBottom: 10,
            paddingHorizontal: 10,
            backgroundColor: 'white'
          }}
        />
        <TextInput
          placeholder="Playlist Description"
          value={playlistDescription}
          onChangeText={setPlaylistDescription}
          style={{
            borderWidth: 1,
            borderColor: 'gray',
            borderRadius: 5,
            marginBottom: 10,
            paddingHorizontal: 10,
            backgroundColor: 'white'
          }}
          multiline
        />
        <Button
          title="Create Playlist"
          color={'white'}
          onPress={() => {
            setIsVisible(false);
            createPlaylist(playlistName, playlistDescription);
          }}
        />
        <Button title="Cancel" onPress={() => setIsVisible(false)} color="red" />
      </View>
    </View>
  </Modal>
);

export default function InputPage({ allTracks, renderItem, playlistStyles, accessToken }: { allTracks: any, renderItem: any, playlistStyles: any, accessToken: string }) {

    // MOVE INTO SEPARATE FILE
    type Track = {
        id: string;
        title: string;
        artist: string;
        duration: number; // Duration in minutes
      };

    const [workoutDuration, setWorkoutDuration] = useState(""); // Workout duration in minutes
    const [submitted, setSubmitted] = useState(false);
    const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
    const [playlistName, setPlaylistName] = useState('My Running Playlist');
    const [playlistDescription, setPlaylistDescription] = useState(
      'Playlist generated for running workouts'
    );
    const [isModalVisible, setIsModalVisible] = useState(false);


    


    const createPlaylist = async (userId: string, name: string, description: string) => {
      try {
        const response = await axios.post(
          `https://api.spotify.com/v1/users/${userId}/playlists`,
          {
            name,
            description,
            public: false,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
    
        console.log('Playlist created:', response.data);
        return response.data.id; // Return the new playlist ID
      } catch (error: any) {
        console.error('Error creating playlist:', error.response?.data || error.message);
      }
    };
        

    const addTracksToPlaylist = async (playlistId: string, trackUris: string[]) => {
      try {
        const response = await axios.post(
          `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
          {
            uris: trackUris,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
    
        console.log('Tracks added to playlist:', response.data);
      } catch (error: any) {
        console.error('Error adding tracks to playlist:', error.response?.data || error.message);
      }
    };
    

    const createPlaylistAndAddTracks = async (name: string, description: string) => {
      try {
        // Fetch user ID
        const userResponse = await axios.get('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userId = userResponse.data.id;
    
        // Create a new playlist
        const playlistId = await createPlaylist(userId, name, description);
    
        if (playlistId) {
          // Collect track URIs
          const trackUris = filteredTracks.map((track) => `spotify:track:${track.id}`);
    
          // Add tracks to the playlist
          await addTracksToPlaylist(playlistId, trackUris);
        }
      } catch (error: any) {
        console.error('Error in playlist creation workflow:', error.response?.data || error.message);
      }
    };        
  
    const handleSubmit = () => {
        const duration = parseFloat(workoutDuration);
        if (isNaN(duration) || duration <= 0) {
          Alert.alert("Invalid Input", "Please enter a valid workout duration in minutes.");
        } else {
          let totalDuration = 0;
          const filtered: Track[] = [];
      
          for (const track of allTracks) {
            if (track.duration !== "Unknown") {
              // Convert "Minutes:seconds" to a floating-point number (minutes)
              const [minutes, seconds] = track.duration.split(":").map(Number);
              const trackDuration = minutes + seconds / 60;
      
              totalDuration += trackDuration;
              
              filtered.push({ ...track }); // Optionally, update duration to numeric
              if (totalDuration > duration) break;
            }
          }
      
          setFilteredTracks(filtered); // Update state with filtered tracks
          setSubmitted(true);
        }
      };
      

    if (submitted) return (
        <>
            <View style={playlistStyles.headerContainer}>
            <Text style={playlistStyles.headerText}>Recommended Playlist</Text>
            </View>
            <FlatList
                data={filteredTracks}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={playlistStyles.songListContainer}
            />
            <Button title="Create Playlist" onPress={() => setIsModalVisible(true)} />
            <PlaylistModal 
              isVisible={isModalVisible}
              setIsVisible={setIsModalVisible}
              playlistName={playlistName}
              setPlaylistName={setPlaylistName}
              playlistDescription={playlistDescription}
              setPlaylistDescription={setPlaylistDescription}
              createPlaylist={createPlaylistAndAddTracks}
            />
        </>
    )
  
    return (
      <View style={styles.container}>
        <Text style={styles.prompt}>How long is your workout?</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter duration in minutes"
          keyboardType="numeric"
          value={workoutDuration}
          onChangeText={setWorkoutDuration}
        />
        <Button title="Submit" onPress={handleSubmit} />
      </View>
    );
  }
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
      backgroundColor: "#f5f5f5",
    },
    prompt: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 16,
      textAlign: "center",
    },
    input: {
      width: "80%",
      height: 50,
      borderWidth: 1,
      borderColor: "#ccc",
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 18,
      marginBottom: 16,
      backgroundColor: "white",
    },
  });