import React, { useEffect, useRef, useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Animated, 
  ActivityIndicator,
  Dimensions,
  Platform
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import webSocketService from "../services/WebSocketService";

// Create animated FlatList
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

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

export default function ScheduleScreen() {
  const route = useRoute();
  const { theme } = useTheme();
  
  const { busObject, searchType, busNumber, source, destination, stop } = route.params || {};
  
  const [busData, setBusData] = useState(busObject);
  const [loading, setLoading] = useState(!busObject?.stops || busObject.stops.length === 0);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [location, setLocation] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");

  const scrollY = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  
  const ITEM_HEIGHT = 100; // row height
  const { width: screenWidth } = Dimensions.get('window');

  const styles = createStyles(theme);

  // ----- Initial data loading -----
  useEffect(() => {
    if (!busObject?.stops || busObject.stops.length === 0) {
      const fetchBusDetails = async () => {
        try {
          setLoading(true);
          const response = await fetch(
            `https://yus.kwscloud.in/yus/get-route?bus_id=${busObject.bus_id}`
          );
          const data = await response.json();
          
          if (data && data.stops && data.stops.length > 0) {
            setBusData(data);
          }
        } catch (error) {
          console.error("Error fetching bus details:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchBusDetails();
    } else {
      setLoading(false);
    }
  }, [busObject]);

  // ----- WebSocket connection and real-time updates -----
  useEffect(() => {
    webSocketService.connect();
    setConnectionStatus("connected");

    const unsubscribe = webSocketService.subscribe((data) => {
      // Handle route/bus updates
      if (data.bus_id === busData.bus_id && !data.latitude) {
        setBusData((prev) => ({ ...prev, ...data }));
        setLoading(false);
        setConnectionStatus("connected");
      }

      // Handle live location updates from driver
      else if (data.latitude && data.longitude) {
        const { latitude, longitude } = data;
        setLocation({ lat: parseFloat(latitude), lon: parseFloat(longitude) });
        setConnectionStatus("connected");

        const stops = busData.stops;
        if (!stops || currentStopIndex >= stops.length - 1) return;

        const currentStop = stops[currentStopIndex];
        const nextStop = stops[currentStopIndex + 1];

        if (!currentStop?.lat || !currentStop?.lon || !nextStop?.lat || !nextStop?.lon) {
          return;
        }

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
      }
    });

    return () => {
      unsubscribe();
    };
  }, [busData.bus_id, currentStopIndex, translateY]);

  // ----- Render each stop -----
  const renderStop = ({ item, index }) => {
    const isActive = index === currentStopIndex;
    const isCompleted = index < currentStopIndex;

    return (
      <View style={styles.stopContainer}>
        <View style={styles.timeline}>
          <View
            style={[
              styles.circle, 
              { 
                backgroundColor: isActive ? theme.primary : 
                                isCompleted ? "#4CAF50" : theme.border 
              }
            ]}
          />
          {index !== busData.stops.length - 1 && (
            <View 
              style={[
                styles.line, 
                { 
                  backgroundColor: isCompleted ? "#4CAF50" : theme.border 
                }
              ]} 
            />
          )}
        </View>

        <View style={[styles.stopDetails, { borderBottomColor: theme.border }]}>
          <View style={styles.stopHeader}>
            <Text style={[
              styles.stopName, 
              { 
                color: isActive ? theme.primary : 
                              isCompleted ? "#4CAF50" : theme.textDark 
              }
            ]}>
              {item.location_name}
            </Text>
            {isActive && (
              <View style={[styles.activeBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.activeBadgeText}>CURRENT</Text>
              </View>
            )}
          </View>
          
          <View style={styles.timeContainer}>
            <Text style={[styles.timeLabel, { color: theme.textLight }]}>
              Arrival: 
            </Text>
            <Text style={[styles.time, { color: theme.textDark }]}>
              {item.arrival_time || "N/A"}
            </Text>
          </View>
          
          <View style={styles.timeContainer}>
            <Text style={[styles.timeLabel, { color: theme.textLight }]}>
              Departure: 
            </Text>
            <Text style={[styles.time, { color: theme.textDark }]}>
              {item.departure_time || "N/A"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ----- Header Info -----
  const getHeaderInfo = () => {
    if (searchType === "busNo" && busNumber) {
      return `Bus #${busNumber} - Live Tracking`;
    } else if (source && destination) {
      return `${source} → ${destination}`;
    } else {
      return `Bus #${busData.bus_id} - Live Tracking`;
    }
  };

  // Calculate bus position combining scroll and GPS position
  const busPosition = Animated.add(translateY, Animated.multiply(scrollY, -1));

  // ----- Loading -----
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textDark }]}>
          Loading bus schedule...
        </Text>
      </View>
    );
  }

  // ----- Render -----
  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.title}>{busData.route_name}</Text>
        <Text style={styles.subtitle}>{getHeaderInfo()}</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {busData.stops?.length || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textLight }]}>
              Total Stops
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {currentStopIndex + 1}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textLight }]}>
              Current Stop
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { 
              color: connectionStatus === "connected" ? "#4CAF50" : "#FF6B6B" 
            }]}>
              ●
            </Text>
            <Text style={[styles.statLabel, { color: theme.textLight }]}>
              {connectionStatus === "connected" ? "Live" : "Offline"}
            </Text>
          </View>
        </View>
      </View>

      {/* Schedule List with Animated Bus */}
      <View style={styles.scheduleContainer}>
        <AnimatedFlatList
          ref={flatListRef}
          data={busData.stops}
          renderItem={renderStop}
          keyExtractor={(item, index) => `${item.stop_sequence}_${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        />

        {/* Animated Bus that moves with scroll and GPS */}
        <Animated.View 
          style={[
            styles.busIcon, 
            { 
              transform: [{ translateY: busPosition }] 
            }
          ]}
        >
          <View style={[styles.busIconContainer, { backgroundColor: theme.primary }]}>
            <Text style={styles.busEmoji}>🚍</Text>
          </View>
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Text style={[styles.locationTitle, { color: theme.textDark }]}>
          Current Location:
        </Text>
        <Text style={[styles.locationText, { color: theme.textLight }]}>
          {location ? 
            `Lat: ${location.lat.toFixed(6)}, Lon: ${location.lon.toFixed(6)}`: 
            "Waiting for GPS updates..."
          }
        </Text>
        <Text style={[styles.connectionStatus, { color: theme.textLight }]}>
          Next stop: {busData.stops?.[currentStopIndex]?.location_name || "N/A"}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.secondary },
    loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.secondary },
    loadingText: { marginTop: 16, fontSize: 16, fontWeight: "500" },
    headerSection: {
      padding: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: { fontSize: 24, fontWeight: "800", color: theme.primary, marginBottom: 4, textAlign: "center" },
    subtitle: { fontSize: 16, color: theme.textLight, marginBottom: 16, textAlign: "center", fontWeight: "500" },
    statsContainer: { flexDirection: "row", justifyContent: "space-around", marginTop: 8 },
    statItem: { alignItems: "center" },
    statValue: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
    statLabel: { fontSize: 12, fontWeight: "500" },
    scheduleContainer: { flex: 1, position: "relative" },
    listContent: { padding: 16, paddingBottom: 100 },
    stopContainer: { flexDirection: "row", alignItems: "flex-start", height: 100 },
    timeline: { width: 40, alignItems: "center" },
    circle: { width: 16, height: 16, borderRadius: 8, marginVertical: 5 },
    line: { width: 2, flex: 1 },
    stopDetails: { flex: 1, paddingLeft: 12, justifyContent: "center", borderBottomWidth: 1, paddingBottom: 16 },
    stopHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    stopName: { fontSize: 16, fontWeight: "700", flex: 1 },
    activeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
    activeBadgeText: { color: theme.secondary, fontSize: 10, fontWeight: "800" },
    timeContainer: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    timeLabel: { fontSize: 13, fontWeight: "500", width: 70 },
    time: { fontSize: 14, fontWeight: "600" },
    busIcon: { 
      position: "absolute", 
      left: 20, 
      top: 16,
      zIndex: 1000,
    },
    busIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    busEmoji: { fontSize: 16 },
    footer: { padding: 16, borderTopWidth: 1, backgroundColor: theme.secondary },
    locationTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
    locationText: { fontSize: 12, marginBottom: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    connectionStatus: { fontSize: 12, fontWeight: "500" },
  });