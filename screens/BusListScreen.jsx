import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import webSocketService from "../services/WebSocketService";

// Helper to calculate distance (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // km
}

export default function BusListScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();

  const {
    src,
    dest,
    buses: initialBuses,
    searchType,
    busNumber,
    source,
    destination,
    stop,
  } = route.params || {};

  const [buses, setBuses] = useState(initialBuses || []);
  const [loading, setLoading] = useState(!initialBuses);
  const [error, setError] = useState(null);

  const actualSource = src || source;
  const actualDestination = dest || destination;

  // Animation ref (for smooth bus movement)
  const busAnim = useRef(new Animated.Value(0)).current;
  const [currentStopIndex, setCurrentStopIndex] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // ----- Fetch buses -----
  useEffect(() => {
    if (initialBuses && initialBuses.length > 0) {
      setLoading(false);
      return;
    }

    const fetchBusRoutes = async () => {
      try {
        setLoading(true);
        setError(null);
        let url = "";

        if (
          searchType === "srcDestStop" &&
          actualSource &&
          actualDestination &&
          stop
        ) {
          url = `https://yus.kwscloud.in/yus/src-${actualSource}&dest-${actualDestination}&stop-${stop}`;
        } else if (actualSource && actualDestination) {
          url = `https://yus.kwscloud.in/yus/src-${actualSource}&dest-${actualDestination}`;
        } else {
          setLoading(false);
          return;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data && data !== "null") {
          setBuses(Array.isArray(data) ? data : [data]);
        } else {
          setBuses([]);
          setError("No buses found for your search criteria.");
        }
      } catch (err) {
        console.error("Error fetching bus routes:", err);
        setError("Failed to load buses. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };

    if (actualSource && actualDestination) fetchBusRoutes();
  }, [actualSource, actualDestination, stop, searchType, busNumber, initialBuses]);

  // ----- WebSocket: Real-time updates -----
  useEffect(() => {
    const unsubscribe = webSocketService.subscribe((data) => {
      if (!data || !data.latitude || !data.longitude) return;

      const lat = parseFloat(data.latitude);
      const lon = parseFloat(data.longitude);

      // Find nearest stop
      if (buses.length > 0 && buses[0]?.stops?.length > 0) {
        const stops = buses[0].stops;
        let nearestIndex = 0;
        let minDist = Infinity;

        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          if (!stop.latitude || !stop.longitude) continue;

          const dist = getDistance(
            lat,
            lon,
            parseFloat(stop.latitude),
            parseFloat(stop.longitude)
          );
          if (dist < minDist) {
            minDist = dist;
            nearestIndex = i;
          }
        }

        if (!initialized) {
          // Jump immediately on first update
          setCurrentStopIndex(nearestIndex);
          busAnim.setValue(nearestIndex);
          setInitialized(true);
        } else {
          // Smoothly animate to new position
          Animated.timing(busAnim, {
            toValue: nearestIndex,
            duration: 800,
            useNativeDriver: false,
          }).start();
          setCurrentStopIndex(nearestIndex);
        }
      }
    });

    return () => unsubscribe();
  }, [buses, initialized]);

  // ----- Bus card press -----
  const handleBusPress = (bus) => {
    if (!bus || !bus.bus_id) {
      Alert.alert("Error", "Invalid bus data");
      return;
    }

    const payload = {
      action: "select_bus",
      bus_id: bus.bus_id,
      route_id: bus.route_id,
      route_name: bus.route_name,
      driver_id: bus.driver_id,
      direction: bus.direction,
      timestamp: new Date().toISOString(),
    };

    webSocketService.send(payload);
    navigation.navigate("Schedule", {
      busObject: bus,
      searchType,
      busNumber: searchType === "busNo" ? busNumber : null,
      source: actualSource,
      destination: actualDestination,
      stop: searchType === "srcDestStop" ? stop : null,
    });
  };

  // ----- Render bus card -----
  const renderBusCard = ({ item }) => {
    const activeIndex = currentStopIndex;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { borderColor: theme.primary },
          pressed && styles.cardPressed,
        ]}
        onPress={() => handleBusPress(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.busNumber, { color: theme.primary }]}>
            Bus #{item.bus_id}
          </Text>
          <Text style={[styles.duration, { color: theme.textLight }]}>
            {item.stops?.length || 0} stops
          </Text>
        </View>

        <Text style={[styles.route, { color: theme.textDark }]}>
          {item.route_name}
        </Text>

        {/* <View style={styles.stopList}>
          {item.stops?.map((stop, index) => {
            const isActive = index === activeIndex;
            return (
              <View key={index} style={styles.stopRow}>
                <View
                  style={[
                    styles.stopDot,
                    {
                      backgroundColor: isActive
                        ? theme.primary
                        : theme.textLight,
                      transform: [{ scale: isActive ? 1.2 : 1 }],
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.stopText,
                    {
                      color: isActive ? theme.primary : theme.textDark,
                      fontWeight: isActive ? "700" : "400",
                    },
                  ]}
                >
                  {stop.location_name}
                </Text>
              </View>
            );
          })}
        </View> */}
      </Pressable>
    );
  };

  const getHeaderTitle = () => {
    if (searchType === "busNo" && busNumber) return `Bus #${busNumber}`;
    else if (
      searchType === "srcDestStop" &&
      actualSource &&
      actualDestination &&
      stop
    )
      return `${actualSource} → ${stop} → ${actualDestination}`;
    else if (actualSource && actualDestination)
      return `${actualSource} → ${actualDestination}`;
    else return "Available Buses";
  };

  const getSubtitle = () => {
    if (searchType === "busNo") return "Bus details";
    else if (searchType === "srcDestStop") return `Via ${stop}`;
    else return `${buses.length} bus${buses.length !== 1 ? "es" : ""} found`;
  };

  const styles = createStyles(theme);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textDark }]}>
          Loading buses...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>{getHeaderTitle()}</Text>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.textLight }]}>
            {error}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.retryButtonText, { color: theme.secondary }]}>
              Back to Search
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.header}>{getHeaderTitle()}</Text>
        <Text style={[styles.subtitle, { color: theme.textLight }]}>
          {getSubtitle()}
        </Text>
      </View>

      <FlatList
        data={buses}
        keyExtractor={(item) =>
          item.bus_id?.toString() || Math.random().toString()
        }
        renderItem={renderBusCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.noData, { color: theme.textLight }]}>
              No buses found
            </Text>
            <Text style={[styles.noDataSubtitle, { color: theme.textLight }]}>
              Try adjusting your search criteria
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.secondary,
      padding: 16,
    },
    headerSection: {
      marginBottom: 20,
      alignItems: "center",
    },
    header: {
      marginTop: 50,
      fontSize: 24,
      fontWeight: "800",
      marginBottom: 8,
      textAlign: "center",
      color: theme.primary,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: "500",
      textAlign: "center",
    },
    listContent: {
      paddingBottom: 20,
    },
    card: {
      backgroundColor: theme.secondary,
      borderWidth: 2,
      borderColor: theme.primary,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    cardPressed: {
      backgroundColor: theme.isDarkMode ? "#1a1a1a" : "#f8f8f8",
      transform: [{ scale: 0.98 }],
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    busNumber: {
      fontSize: 20,
      fontWeight: "800",
    },
    duration: {
      fontSize: 14,
      fontWeight: "600",
    },
    route: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 12,
    },
    stopList: {
      marginTop: 8,
      paddingLeft: 8,
    },
    stopRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    stopDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },
    stopText: {
      fontSize: 15,
    },
    loader: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.secondary,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      fontWeight: "500",
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },
    errorText: {
      fontSize: 16,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 22,
    },
    retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      minWidth: 160,
    },
    retryButtonText: {
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
  });

