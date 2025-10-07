import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";

export default function BusListScreen() {
  const route = useRoute();
  const { 
    buses: initialBuses, 
    searchType, 
    busNumber, 
    source, 
    destination, 
    stop 
  } = route.params;
  const navigation = useNavigation();
  const { theme } = useTheme();

  const [buses, setBuses] = useState(initialBuses || []);
  const [loading, setLoading] = useState(!initialBuses);

  useEffect(() => {
    // If buses are already passed (like in bus number search), don't fetch again
    if (initialBuses) {
      setLoading(false);
      return;
    }

    // Only fetch if it's a source-destination search without initial data
    const fetchBusRoutes = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `https://yus.kwscloud.in/yus/src-${source}&dest-${destination}`
        );
        const data = await res.json();
        setBuses(Array.isArray(data) ? data : [data]);
      } catch (err) {
        console.error("Error fetching bus routes:", err);
      } finally {
        setLoading(false);
      }
    };

    if (source && destination) {
      fetchBusRoutes();
    }
  }, [source, destination, initialBuses]);

  const styles = createStyles(theme);

  // Render bus details when searching by bus number
  const renderBusDetailView = () => {
    const bus = buses[0];
    
    if (!bus) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noData}>No bus found with this number</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.busDetailContainer}>
        {/* Bus Header */}
        <View style={styles.busHeader}>
          <Text style={styles.busNumberLarge}>Bus #{bus.bus_id}</Text>
          <Text style={styles.busRoute}>{bus.route_name}</Text>
        </View>

        {/* Route Information */}
        <View style={styles.routeSection}>
          <View style={styles.routeVisual}>
            <View style={styles.routePoint}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
            </View>
            
            <View style={styles.routeInfo}>
              <View style={styles.routeStop}>
                <Text style={styles.stopName}>{bus.src}</Text>
                <Text style={styles.stopTime}>{bus.stops?.[0]?.departure_time || "08:00"}</Text>
              </View>
              
              <View style={styles.routeStopsInfo}>
                <Text style={styles.stopsCount}>
                  {bus.stops?.length || 0} stops • {bus.stops?.[0]?.departure_time} - {bus.stops?.[bus.stops?.length - 1]?.arrival_time}
                </Text>
              </View>
              
              <View style={styles.routeStop}>
                <Text style={styles.stopName}>{bus.dest}</Text>
                <Text style={styles.stopTime}>{bus.stops?.[bus.stops?.length - 1]?.arrival_time || "09:00"}</Text>
              </View>
            </View>

            <View style={styles.routePoint}>
              <View style={styles.routeLine} />
              <View style={[styles.routeDot, styles.routeDotDest]} />
            </View>
          </View>
        </View>

        {/* All Stops List */}
        <View style={styles.stopsSection}>
          <Text style={styles.sectionTitle}>All Stops</Text>
          <View style={styles.stopsList}>
            {bus.stops?.map((stop, index) => (
              <View key={index} style={styles.stopItem}>
                <View style={styles.stopTimeline}>
                  <View style={[
                    styles.stopDot,
                    index === 0 && styles.stopDotFirst,
                    index === bus.stops.length - 1 && styles.stopDotLast
                  ]} />
                  {index < bus.stops.length - 1 && <View style={styles.stopLine} />}
                </View>
                <View style={styles.stopDetails}>
                  <Text style={styles.stopLocation}>{stop.location_name}</Text>
                  <Text style={styles.stopTiming}>
                    {stop.arrival_time} - {stop.departure_time}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* View Schedule Button */}
        <Pressable
          style={({ pressed }) => [styles.scheduleButton, pressed && styles.buttonPressed]}
          onPress={() => navigation.navigate("Schedule", { busObject: bus })}
        >
          <Text style={styles.scheduleButtonText}>VIEW FULL SCHEDULE</Text>
        </Pressable>
      </ScrollView>
    );
  };

  // Regular bus card for source-destination search
  const renderBusCard = ({ item }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => navigation.navigate("Schedule", { busObject: item })}
    >
      <View style={styles.row}>
        <Text style={styles.busNumber}>Bus #{item.bus_id}</Text>
        <Text style={styles.duration}>{item.stops?.length || 0} stops</Text>
      </View>

      <Text style={styles.route}>{item.route_name}</Text>

      <View style={styles.row}>
        <Text style={styles.time}>{item.stops?.[0]?.departure_time || "08:00"}</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.time}>{item.stops?.[item.stops?.length - 1]?.arrival_time || "09:00"}</Text>
      </View>

      <Text style={styles.stops}>
        {item.stops?.map((s) => s.location_name).join(" → ")}
      </Text>
    </Pressable>
  );

  // Regular bus list view for source-destination search
  const renderBusListView = () => (
    <View style={styles.container}>
      <Text style={styles.header}>
        {source && destination ? `${source} → ${destination}` : 'Available Buses'}
      </Text>
      <FlatList
        data={buses}
        keyExtractor={(item) => item.bus_id?.toString()}
        renderItem={renderBusCard}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={[styles.noData, { color: theme.textLight }]}>
            No buses found
          </Text>
        }
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textDark }]}>
          {searchType === 'busNo' ? 'Loading bus details...' : 'Loading buses...'}
        </Text>
      </View>
    );
  }

  // Show detailed view for bus number search, list view for others
  return searchType === 'busNo' ? renderBusDetailView() : renderBusListView();
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.secondary,
    padding: 16,
  },
  busDetailContainer: {
    flex: 1,
    backgroundColor: theme.secondary,
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
    color: theme.primary,
  },
  // Bus Detail View Styles
  busHeader: {
    alignItems: 'center',
    marginBottom: 30,
    padding: 20,
    backgroundColor: theme.primary + '15',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  busNumberLarge: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.primary,
    marginBottom: 8,
  },
  busRoute: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.textDark,
    textAlign: 'center',
  },
  routeSection: {
    marginBottom: 30,
  },
  routeVisual: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routePoint: {
    alignItems: 'center',
    width: 30,
  },
  routeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.primary,
  },
  routeDotDest: {
    backgroundColor: '#FF6B6B',
  },
  routeLine: {
    width: 2,
    height: 40,
    backgroundColor: theme.primary + '40',
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  routeStop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  stopName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.textDark,
    flex: 1,
  },
  stopTime: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.primary,
    marginLeft: 10,
  },
  routeStopsInfo: {
    alignItems: 'center',
    marginVertical: 10,
  },
  stopsCount: {
    fontSize: 14,
    color: theme.textLight,
    fontStyle: 'italic',
  },
  stopsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.textDark,
    marginBottom: 16,
  },
  stopsList: {
    backgroundColor: theme.isDarkMode ? '#1a1a1a' : '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stopTimeline: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.primary + '80',
  },
  stopDotFirst: {
    backgroundColor: theme.primary,
  },
  stopDotLast: {
    backgroundColor: '#FF6B6B',
  },
  stopLine: {
    width: 2,
    height: 30,
    backgroundColor: theme.primary + '30',
    marginTop: 2,
  },
  stopDetails: {
    flex: 1,
  },
  stopLocation: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.textDark,
    marginBottom: 4,
  },
  stopTiming: {
    fontSize: 12,
    color: theme.textLight,
  },
  scheduleButton: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  scheduleButtonText: {
    color: theme.secondary,
    fontSize: 16,
    fontWeight: "bold",
  },
  // Regular Bus List Styles
  card: {
    backgroundColor: theme.secondary,
    borderWidth: 1,
    borderColor: theme.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardPressed: {
    backgroundColor: theme.isDarkMode ? "#1a1a1a" : "#f8f8f8",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  busNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.primary,
  },
  route: {
    fontSize: 16,
    color: theme.textDark,
    marginBottom: 6,
  },
  duration: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.textLight,
  },
  time: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.textDark,
  },
  arrow: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.primary,
    marginHorizontal: 5,
  },
  stops: {
    fontSize: 13,
    color: theme.textLight,
    marginTop: 8,
  },
  noData: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 50,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.secondary,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.secondary,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});