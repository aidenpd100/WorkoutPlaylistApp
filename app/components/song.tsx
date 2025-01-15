import { Image, Text, View } from "react-native";

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}

export default function Song({
  item,
  runnabilityScore,
  duration,
}: {
  item: Track;
  runnabilityScore: number | undefined;
  duration: string | undefined;
}) {
  return (
    <View style={{ flexDirection: "row", marginVertical: 10, alignItems: "center" }}>
      <Image
        source={{ uri: item.album.images[0]?.url }}
        style={{ width: 50, height: 50, marginRight: 10 }}
      />
      <View>
        <Text style={{ fontWeight: "bold" }}>{item.name}</Text>
        <Text>{item.artists.map((artist) => artist.name).join(", ")}</Text>
        {duration && <Text>Duration: {duration}</Text>}
        {runnabilityScore != undefined && (
          <Text>Runnability: {parseFloat(runnabilityScore.toFixed(3))}</Text>
        )}
      </View>
    </View>
  );
}
