import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import webSocketService from "../services/WebSocketService";

export default function SearchScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const [searchType, setSearchType] = useState("srcDest");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [stop, setStop] = useState("");
  const [busNumber, setBusNumber] = useState("");
  const [busPreview, setBusPreview] = useState(null);
  const [busList, setBusList] = useState([]);
  const [buttonScale] = useState(new Animated.Value(1));

  const styles = createStyles(theme);

  // ----- WebSocket Connection -----
  useEffect(() => {
    if (isFocused) {
      webSocketService.connect();
    } else {
      // Keep WebSocket alive while navigating; don't disconnect here
    }

    return () => {
      // Disconnect only if app closes; otherwise keep alive
    };
  }, [isFocused]);

  // ----- Subscribe to bus updates -----
  useEffect(() => {
    const unsubscribe = webSocketService.subscribe((data) => {
      // For bus number search - real-time updates
      if (data.type === "bus_update" && data.bus_id === busNumber) {
        setBusPreview((prev) => ({ ...prev, ...data }));
      }
      
      // For source-destination search - expecting buses array
      if (Array.isArray(data)) {
        setBusList(data);
      }
    });
    return () => unsubscribe();
  }, [busNumber]);

  // ----- Clear fields when focused -----
  useEffect(() => {
    if (isFocused) clearAllFields();
  }, [isFocused]);

  const clearAllFields = () => {
    setSource("");
    setDestination("");
    setStop("");
    setBusNumber("");
    setBusPreview(null);
    setBusList([]);
  };

  const handleReverseRoute = () => {
    const temp = source;
    setSource(destination);
    setDestination(temp);
  };

  // ----- Fetch bus preview -----
  const fetchBusPreview = async (text) => {
    if (!text.trim()) {
      setBusPreview(null);
      return;
    }

    try {
      const response = await fetch(
        `https://yus.kwscloud.in/yus/get-route?bus_id=${text.trim()}`
      );
      const data = await response.json();

      if (data.route_id !== 0 && data.bus_id !== 0) {
        setBusPreview(data);
        webSocketService.send({ action: "subscribe_bus", bus_id: text.trim() });
      } else {
        setBusPreview(null);
      }
    } catch (error) {
      console.error("Bus preview error:", error);
      setBusPreview(null);
    }
  };

  // Debounce bus number input
  useEffect(() => {
    const handler = setTimeout(() => fetchBusPreview(busNumber), 300);
    return () => clearTimeout(handler);
  }, [busNumber]);

  // ----- Search Handler -----
  const handleFindBus = async () => {
    // Button animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      let url = "";
      let searchData = {};

      if (searchType === "srcDest") {
        if (!source.trim() || !destination.trim()) {
          Alert.alert("Missing Fields", "Please enter both source and destination.");
          return;
        }
        
        // Use WebSocket for real-time search
        webSocketService.send({
          action: "search_buses",
          src: source.trim(),
          dest: destination.trim(),
        });

        // Navigate with current bus list (will be updated via WebSocket)
        navigation.navigate("BusList", { 
          src: source, 
          dest: destination, 
          buses: busList,
          searchType: "srcDest" 
        });
        return;

      } else if (searchType === "srcDestStop") {
        if (!source.trim() || !destination.trim() || !stop.trim()) {
          Alert.alert("Missing Fields", "Please enter source, destination, and stop.");
          return;
        }
        url = `https://yus.kwscloud.in/yus/src-${source.trim()}&dest-${destination.trim()}&stop-${stop.trim()}`;
        searchData = { searchType, source, destination, stop };
        
      } else if (searchType === "busNo") {
        if (!busNumber.trim()) {
          Alert.alert("Missing Field", "Please enter bus number.");
          return;
        }
        url = `https://yus.kwscloud.in/yus/get-route?bus_id=${busNumber.trim()}`;
        searchData = { searchType: "busNo", busNumber };
      }

      // For non-WebSocket searches, use HTTP
      if (searchType !== "srcDest") {
        const response = await fetch(url);
        const data = await response.json();

        if (searchType === "busNo") {
          if (data.route_id === 0 && data.bus_id === 0) {
            Alert.alert("Not Found", "No bus found with this number.");
            return;
          }
          navigation.navigate("BusList", { buses: [data], ...searchData });
        } else {
          if (!data || data === "null" || (Array.isArray(data) && data.length === 0)) {
            Alert.alert("Not Found", "No buses found for your search criteria.");
            return;
          }
          navigation.navigate("BusList", { buses: data, ...searchData });
        }
      }

    } catch (error) {
      console.error("Search error:", error);
      Alert.alert("Error", "Failed to search for buses. Please try again.");
    }
  };

  // ----- Simple Search Handler (from first version) -----
  const handleSimpleSearch = () => {
    if (!source.trim() || !destination.trim()) {
      alert("Please enter source and destination");
      return;
    }

    // Send src/dest to server via WebSocket
    webSocketService.send({
      action: "search_buses",
      src: source.trim(),
      dest: destination.trim(),
    });

    // Navigate to BusListScreen with current bus list
    navigation.navigate("BusList", { 
      src: source, 
      dest: destination, 
      buses: busList,
      searchType: "srcDest" 
    });
  };

  // ----- Render Components -----
  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.appTitle}>BusBuddy</Text>
          <Text style={styles.appSubtitle}>Find your perfect bus route</Text>
        </View>
        <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
          <Text style={styles.themeToggleText}>{isDarkMode ? "☀️" : "🌙"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchTypeSelector = () => (
    <View style={styles.searchTypeSection}>
      <Text style={styles.sectionTitle}>Choose Search Method</Text>
      <View style={styles.searchTypeGrid}>
        {[
          { key: "srcDest", label: "Direct Route", emoji: "📍" },
          { key: "srcDestStop", label: "Via Stop", emoji: "🛑" },
          { key: "busNo", label: "Bus Number", emoji: "🚍" },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.searchTypeCard, searchType === item.key && styles.searchTypeCardActive]}
            onPress={() => setSearchType(item.key)}
          >
            <View style={[styles.searchTypeIcon, searchType === item.key && styles.searchTypeIconActive]}>
              <Text style={styles.searchTypeEmoji}>{item.emoji}</Text>
            </View>
            <Text style={[styles.searchTypeLabel, searchType === item.key && styles.searchTypeLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSearchBySourceDest = () => (
    <View style={styles.inputSection}>
      <View style={styles.routeCard}>
        <View style={styles.routeHeader}>
          <View style={styles.routeTitleContainer}>
            <Text style={styles.routeIcon}>🗺️</Text>
            <Text style={styles.routeTitle}>Plan Your Journey</Text>
          </View>
        </View>
        <View style={styles.sideBySideContainer}>
          <View style={styles.sideBySideInput}>
            <Text style={styles.sideBySideLabel}>FROM</Text>
            <TextInput
              style={styles.sideBySideField}
              placeholder="Source"
              value={source}
              onChangeText={setSource}
              placeholderTextColor={theme.textLight}
            />
          </View>
          <TouchableOpacity style={styles.sideBySideReverseButton} onPress={handleReverseRoute}>
            <Text style={styles.sideBySideReverseIcon}>⇄</Text>
          </TouchableOpacity>
          <View style={styles.sideBySideInput}>
            <Text style={styles.sideBySideLabel}>TO</Text>
            <TextInput
              style={styles.sideBySideField}
              placeholder="Destination"
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor={theme.textLight}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderSearchBySourceDestStop = () => (
    <View style={styles.inputSection}>
      <View style={styles.routeCard}>
        <View style={styles.routeHeader}>
          <View style={styles.routeTitleContainer}>
            <Text style={styles.routeIcon}>🛣️</Text>
            <Text style={styles.routeTitle}>Journey with Stop</Text>
          </View>
        </View>
        <View style={styles.stopsContainer}>
          {[
            { label: "Departure Point", value: source, setter: setSource, icon: "📍", placeholder: "Starting location" },
            { label: "Intermediate Stop", value: stop, setter: setStop, icon: "🛑", placeholder: "Stop along the way" },
            { label: "Final Destination", value: destination, setter: setDestination, icon: "🎯", placeholder: "End destination" },
          ].map((item, index) => (
            <View key={index} style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputIcon}>{item.icon}</Text>
                <Text style={styles.inputLabel}>{item.label}</Text>
              </View>
              <TextInput
                style={styles.modernInput}
                placeholder={item.placeholder}
                value={item.value}
                onChangeText={item.setter}
                placeholderTextColor={theme.textLight}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderSearchByBusNumber = () => (
    <View style={styles.inputSection}>
      <View style={styles.busNumberCard}>
        <View style={styles.busNumberHeader}>
          <View style={styles.busNumberTitleContainer}>
            <Text style={styles.busNumberIcon}>🔍</Text>
            <View>
              <Text style={styles.busNumberTitle}>Spot Bus</Text>
              <Text style={styles.busNumberSubtitle}>Track by bus number</Text>
            </View>
          </View>
        </View>
        <View style={styles.busInputWrapper}>
          <View style={styles.busNumberInputContainer}>
            <TextInput
              style={styles.busNumberInput}
              placeholder="27"
              value={busNumber}
              onChangeText={setBusNumber}
              placeholderTextColor={theme.textLight}
              keyboardType="numeric"
              textAlign="center"
              maxLength={4}
            />
          </View>
          <Text style={styles.busInputLabel}>ENTER BUS NUMBER</Text>
        </View>

        {busPreview && (
          <View style={styles.busPreview}>
            <View style={styles.busPreviewHeader}>
              <View>
                <Text style={styles.busPreviewTitle}>Bus #{busPreview.bus_id}</Text>
                <Text style={styles.busPreviewRoute}>{busPreview.route_name}</Text>
              </View>
              <View style={styles.busPreviewBadge}>
                <Text style={styles.busPreviewBadgeText}>{busPreview.stops?.length || 0} stops</Text>
              </View>
            </View>
            <View style={styles.busPreviewRouteInfo}>
              <View style={styles.routeTimeline}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineLine} />
                <View style={[styles.timelineDot, styles.timelineDotDest]} />
              </View>
              <View style={styles.routeDetails}>
                <Text style={styles.busPreviewDirection}>
                  {busPreview.src} → {busPreview.dest}
                </Text>
                <Text style={styles.busPreviewTiming}>
                  {busPreview.stops?.[0]?.departure_time} - {busPreview.stops?.[busPreview.stops?.length - 1]?.arrival_time}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );

  const renderSearchButton = () => (
    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
      <TouchableOpacity style={styles.searchButton} onPress={handleFindBus} activeOpacity={0.9}>
        <View style={styles.searchButtonContent}>
          <Text style={styles.searchButtonIcon}>🚀</Text>
          <Text style={styles.searchButtonText}>Find Buses</Text>
          <Text style={styles.arrowIcon}>→</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {renderHeader()}
        {renderSearchTypeSelector()}
        {searchType === "srcDest" && renderSearchBySourceDest()}
        {searchType === "srcDestStop" && renderSearchBySourceDestStop()}
        {searchType === "busNo" && renderSearchByBusNumber()}
        {renderSearchButton()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.secondary,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  headerSection: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.primary,
    letterSpacing: -1,
  },
  appSubtitle: {
    fontSize: 14,
    color: theme.textLight,
    marginTop: 2,
    fontWeight: "500",
  },
  themeToggle: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: theme.primary + '15',
    borderWidth: 1.5,
    borderColor: theme.primary + '25',
  },
  themeToggleText: {
    fontSize: 18,
    color: theme.primary,
  },
  searchTypeSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  searchTypeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  searchTypeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.border + '80',
    alignItems: 'center',
    backgroundColor: theme.secondary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchTypeCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '08',
    shadowColor: theme.primary,
    shadowOpacity: 0.1,
    elevation: 4,
    transform: [{ translateY: -1 }],
  },
  searchTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchTypeIconActive: {
    backgroundColor: theme.primary + '15',
    borderColor: theme.primary + '30',
  },
  searchTypeEmoji: {
    fontSize: 18,
  },
  searchTypeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textDark,
    textAlign: 'center',
  },
  searchTypeLabelActive: {
    color: theme.primary,
  },
  inputSection: {
    marginBottom: 24,
  },
  routeCard: {
    backgroundColor: theme.secondary,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  routeHeader: {
    marginBottom: 20,
  },
  routeTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.textDark,
  },
  sideBySideContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sideBySideInput: {
    flex: 1,
  },
  sideBySideLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textDark,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sideBySideField: {
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: theme.textDark,
    backgroundColor: theme.secondary,
    fontWeight: "500",
  },
  sideBySideReverseButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: theme.primary + '15',
    borderWidth: 2,
    borderColor: theme.primary + '25',
    marginBottom: 6,
  },
  sideBySideReverseIcon: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.primary,
  },
  stopsContainer: {
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.textDark,
  },
  inputIcon: {
    fontSize: 16,
  },
  modernInput: {
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: theme.textDark,
    backgroundColor: theme.secondary,
    fontWeight: "500",
  },
  busNumberCard: {
    backgroundColor: theme.secondary,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  busNumberHeader: {
    marginBottom: 20,
  },
  busNumberTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  busNumberIcon: {
    fontSize: 24,
  },
  busNumberTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.primary,
    marginBottom: 2,
  },
  busNumberSubtitle: {
    fontSize: 13,
    color: theme.textLight,
    fontWeight: "500",
  },
  busInputWrapper: {
    alignItems: 'center',
  },
  busNumberInputContainer: {
    borderWidth: 3,
    borderColor: '#FFD700',
    borderRadius: 16,
    backgroundColor: theme.secondary,
    marginBottom: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  busNumberInput: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    fontSize: 28,
    fontWeight: "800",
    color: theme.textDark,
    backgroundColor: 'transparent',
    width: 140,
    textAlign: 'center',
    letterSpacing: 2,
  },
  busInputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  busPreview: {
    marginTop: 20,
    padding: 16,
    backgroundColor: theme.primary + '08',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.primary + '20',
  },
  busPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  busPreviewTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.primary,
    marginBottom: 4,
  },
  busPreviewRoute: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.textDark,
  },
  busPreviewBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  busPreviewBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.secondary,
  },
  busPreviewRouteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeTimeline: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.primary,
  },
  timelineDotDest: {
    backgroundColor: '#FF6B6B',
  },
  timelineLine: {
    width: 2,
    height: 16,
    backgroundColor: theme.primary + '40',
    marginVertical: 3,
  },
  routeDetails: {
    flex: 1,
  },
  busPreviewDirection: {
    fontSize: 14,
    color: theme.textDark,
    fontWeight: "600",
    marginBottom: 2,
  },
  busPreviewTiming: {
    fontSize: 12,
    color: theme.textLight,
    fontWeight: "500",
  },
  searchButton: {
    backgroundColor: theme.primary,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  searchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  searchButtonIcon: {
    fontSize: 20,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.secondary,
  },
  arrowIcon: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.secondary,
  },
});