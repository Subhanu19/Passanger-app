import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, Animated } from "react-native";
import { useTheme } from "../context/ThemeContext";

// WebSocket connection
const websocket = new WebSocket("wss://yus.kwscloud.in/yus/passenger-ws");

// Distance calculation (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = (x) => (x * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

export default function ScheduleScreen({ route }) {
  const { busObject } = route.params;
  const { theme } = useTheme();
  const translateY = useRef(new Animated.Value(0)).current;
  const ITEM_HEIGHT = 100; // row height
  const [currentStopIndex, setCurrentStopIndex] = useState(0);

  const styles = createStyles(theme);

  // Handle live driver location
  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { latitude, longitude } = data;

        const stops = busObject.stops;

        if (currentStopIndex >= stops.length - 1) return;

        const currentStop = stops[currentStopIndex];
        const nextStop = stops[currentStopIndex + 1];

        const totalDist = getDistance(
          parseFloat(currentStop.lat),
          parseFloat(currentStop.lon),
          parseFloat(nextStop.lat),
          parseFloat(nextStop.lon)
        );

        const distToNext = getDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          parseFloat(nextStop.lat),
          parseFloat(nextStop.lon)
        );

        const distFromCurrent = getDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          parseFloat(currentStop.lat),
          parseFloat(currentStop.lon)
        );

        const progress = Math.min(1, Math.max(0, distFromCurrent / totalDist));

        const busY = (currentStopIndex + progress) * ITEM_HEIGHT;

        Animated.timing(translateY, {
          toValue: busY,
          duration: 1000,
          useNativeDriver: true,
        }).start();

        const threshold = Math.max(5, totalDist * 0.1);
        if (distToNext < threshold) {
          setCurrentStopIndex((prev) => Math.min(prev + 1, stops.length - 1));
        }
      } catch (err) {
        console.error("Invalid WS data", err);
      }
    };

    websocket.onmessage = handleMessage;

    return () => {
      websocket.onmessage = null;
    };
  }, [currentStopIndex, translateY, busObject.stops]);

  const renderItem = ({ item, index }) => {
    const isActive = index === currentStopIndex;
    return (
      <View style={styles.stopContainer}>
        <View style={styles.timeline}>
          <View
            style={[
              styles.circle,
              { backgroundColor: isActive ? theme.primary : theme.border },
            ]}
          />
          {index !== busObject.stops.length - 1 && (
            <View style={[styles.line, { backgroundColor: theme.border }]} />
          )}
        </View>

        <View style={[styles.stopDetails, { borderBottomColor: theme.border }]}>
          <Text 
            style={[
              styles.stopName, 
              { color: isActive ? theme.primary : theme.textDark }
            ]}
          >
            {item.location_name}
          </Text>
          <Text style={[styles.time, { color: theme.textLight }]}>
            Arrival: {busObject.arrival_time}
          </Text>
          <Text style={[styles.time, { color: theme.textLight }]}>
            Departure: {busObject.departure_time}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule for Bus {busObject.bus_id}</Text>

      <View style={{ flex: 1 }}>
        <FlatList
          data={busObject.stops}
          renderItem={renderItem}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={{ paddingBottom: 50 }}
        />

        <Animated.View style={[styles.busIcon, { transform: [{ translateY }] }]}>
          <Text style={{ fontSize: 24 }}>🚍</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.secondary, 
    padding: 20 
  },
  title: { 
    fontSize: 22, 
    fontWeight: "bold", 
    color: theme.primary, 
    marginBottom: 20, 
    textAlign: "center" 
  },
  stopContainer: { 
    flexDirection: "row", 
    alignItems: "flex-start", 
    height: 100 
  },
  timeline: { 
    width: 40, 
    alignItems: "center" 
  },
  circle: { 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    marginVertical: 5 
  },
  line: { 
    width: 2, 
    flex: 1 
  },
  stopDetails: { 
    flex: 1, 
    paddingLeft: 10, 
    justifyContent: "center", 
    borderBottomWidth: 1 
  },
  stopName: { 
    fontSize: 18, 
    fontWeight: "600" 
  },
  time: { 
    fontSize: 14 
  },
  busIcon: { 
    position: "absolute", 
    left: 12, 
    top: 0 
  },
});