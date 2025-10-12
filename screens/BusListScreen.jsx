import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import webSocketService from "../services/WebSocketService";

export default function BusListScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();

  // Extract all possible parameters
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

  // Determine actual source and destination from different parameter names
  const actualSource = src || source;
  const actualDestination = dest || destination;

  // ----- Fetch buses if not passed via route params -----
  useEffect(() => {
    // If we already have buses, don't fetch again
    if (initialBuses && initialBuses.length > 0) {
      setLoading(false);
      return;
    }

    // For bus number search, we should have received the bus data directly
    if (searchType === "busNo" && busNumber) {
      setLoading(false);
      return;
    }

    // For source-destination search without initial data, fetch from API
    const fetchBusRoutes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let url = "";
        
        if (searchType === "srcDestStop" && actualSource && actualDestination && stop) {
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
        setError("Failed to load buses. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };

    if (actualSource && actualDestination) {
      fetchBusRoutes();
    } else {
      setLoading(false);
    }
  }, [actualSource, actualDestination, stop, searchType, busNumber, initialBuses]);

  // ----- WebSocket: Subscribe for real-time updates -----
  useEffect(() => {
    // Only subscribe to WebSocket if we're using source-destination search
    if (searchType === "srcDest" && actualSource && actualDestination) {
      const unsubscribe = webSocketService.subscribe((data) => {
        // Handle array of buses from search
        if (Array.isArray(data)) {
          setBuses(data);
        }
        // Handle individual bus updates
        else if (data.type === "bus_update") {
          setBuses((prev) =>
            prev.map((bus) =>
              bus.bus_id === data.bus_id ? { ...bus, ...data } : bus
            )
          );
        }
      });

      return () => unsubscribe();
    }
  }, [searchType, actualSource, actualDestination]);

  // ----- Handle bus selection -----
  const handleBusPress = (bus) => {
    if (!bus || !bus.bus_id) {
      Alert.alert("Error", "Invalid bus data");
      return;
    }

    // Send selected bus info to server via WebSocket
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
    console.log("📤 Sent bus selection via WebSocket:", payload);

    // Navigate to schedule screen with complete bus object
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
  const renderBusCard = ({ item }) => (
    <Pressable
      style={({ pressed }) => [
        styles.card, 
        { borderColor: theme.primary },
        pressed && styles.cardPressed
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

      <View style={styles.routeInfo}>
        <Text style={[styles.time, { color: theme.textDark }]}>
          {item.stops?.[0]?.departure_time || "08:00"}
        </Text>
        <Text style={[styles.arrow, { color: theme.primary }]}>→</Text>
        <Text style={[styles.time, { color: theme.textDark }]}>
          {item.stops?.[item.stops?.length - 1]?.arrival_time || "09:00"}
        </Text>
      </View>

      <Text style={[styles.direction, { color: theme.textLight }]}>
        {item.src || actualSource} → {item.dest || actualDestination}
      </Text>

      {item.stops && item.stops.length > 0 && (
        <Text style={[styles.stops, { color: theme.textLight }]} numberOfLines={1}>
          {item.stops.slice(0, 3).map(s => s.location_name).join(" → ")}
          {item.stops.length > 3 ? " ..." : ""}
        </Text>
      )}
    </Pressable>
  );

  // ----- Get header title based on search type -----
  const getHeaderTitle = () => {
    if (searchType === "busNo" && busNumber) {
      return `Bus #${busNumber}`;
    } else if (searchType === "srcDestStop" && actualSource && actualDestination && stop) {
      return `${actualSource} → ${stop} → ${actualDestination}`;
    } else if (actualSource && actualDestination) {
      return `${actualSource} → ${actualDestination}`;
    } else {
      return "Available Buses";
    }
  };

  // ----- Get subtitle based on search type -----
  const getSubtitle = () => {
    if (searchType === "busNo") {
      return "Bus details";
    } else if (searchType === "srcDestStop") {
      return `Via ${stop}`;
    } else {
      return `${buses.length} bus${buses.length !== 1 ? 'es' : ''} found`;
    }
  };

  const styles = createStyles(theme);

  // ----- Loading state -----
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

  // ----- Error state -----
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

  // ----- Main render -----
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
        keyExtractor={(item) => item.bus_id?.toString() || Math.random().toString()}
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
      marginTop:50,
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
    routeInfo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    time: {
      fontSize: 16,
      fontWeight: "600",
    },
    arrow: {
      fontSize: 18,
      fontWeight: "bold",
      marginHorizontal: 12,
    },
    direction: {
      fontSize: 15,
      fontWeight: "500",
      textAlign: "center",
      marginBottom: 8,
    },
    stops: {
      fontSize: 13,
      fontWeight: "400",
      textAlign: "center",
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    noData: {
      fontSize: 18,
      fontWeight: "600",
      textAlign: "center",
      marginBottom: 8,
    },
    noDataSubtitle: {
      fontSize: 14,
      textAlign: "center",
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