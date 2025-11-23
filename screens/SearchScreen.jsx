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
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";

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

  // WebSocket Connection
  useEffect(() => {
    if (isFocused) {
      webSocketService.connect();
    }
    return () => {};
  }, [isFocused]);

  // Subscribe to bus updates
  useEffect(() => {
    const unsubscribe = webSocketService.subscribe((data) => {
      if (data.type === "bus_update" && data.bus_id === busNumber) {
        setBusPreview((prev) => ({ ...prev, ...data }));
      }
      if (Array.isArray(data)) {
        setBusList(data);
      }
    });
    return () => unsubscribe();
  }, [busNumber]);

  // Clear fields when focused
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

  // Fetch bus preview
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
      setBusPreview(null);
    }
  };

  // Debounce bus number input
  useEffect(() => {
    const handler = setTimeout(() => fetchBusPreview(busNumber), 300);
    return () => clearTimeout(handler);
  }, [busNumber]);

  // Search Handler
  const handleFindBus = async () => {
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
      if (searchType === "srcDest") {
        if (!source.trim() || !destination.trim()) {
          Alert.alert("Missing Fields", "Please enter both source and destination.");
          return;
        }
        webSocketService.send({
          action: "search_buses",
          src: source.trim(),
          dest: destination.trim(),
        });
        navigation.navigate("BusList", { 
          src: source, 
          dest: destination, 
          buses: busList,
          searchType: "srcDest" 
        });
      } else if (searchType === "srcDestStop") {
        if (!source.trim() || !destination.trim() || !stop.trim()) {
          Alert.alert("Missing Fields", "Please enter source, destination, and stop.");
          return;
        }
        const url = `https://yus.kwscloud.in/yus/src-${source.trim()}&dest-${destination.trim()}&stop-${stop.trim()}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data || data === "null" || (Array.isArray(data) && data.length === 0)) {
          Alert.alert("Not Found", "No buses found for your search criteria.");
          return;
        }
        navigation.navigate("BusList", { 
          buses: data, 
          searchType, 
          source, 
          destination, 
          stop 
        });
      } else if (searchType === "busNo") {
        if (!busNumber.trim()) {
          Alert.alert("Missing Field", "Please enter bus number.");
          return;
        }
        const url = `https://yus.kwscloud.in/yus/get-route?bus_id=${busNumber.trim()}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.route_id === 0 && data.bus_id === 0) {
          Alert.alert("Not Found", "No bus found with this number.");
          return;
        }
        navigation.navigate("BusList", { 
          buses: [data], 
          searchType: "busNo", 
          busNumber 
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to search for buses. Please try again.");
    }
  };

  // Render Components
  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.appTitle}>YELLOH BUS</Text>
          <Text style={styles.appSubtitle}>Plan your journey effortlessly</Text>
        </View>
        <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
          <Ionicons 
            name={isDarkMode ? "sunny" : "moon"} 
            size={20} 
            color={theme.textSecondary} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchTypeSelector = () => (
    <View style={styles.searchTypeSection}>
      <Text style={styles.sectionLabel}>Choose Search Method</Text>
      <View style={styles.searchTypeContainer}>
        {[
          { 
            key: "busNo", 
            label: "BUS NO", 
            icon: <FontAwesome5 name="bus" size={16} color={searchType === "busNo" ? theme.secondary : theme.textSecondary} />
          },
          { 
            key: "srcDest", 
            label: "DIRECT", 
            icon: <MaterialIcons name="route" size={20} color={searchType === "srcDest" ? theme.secondary : theme.textSecondary} />
          },
          { 
            key: "srcDestStop", 
            label: "VIA STOP", 
            icon: <FontAwesome5 name="map-marker-alt" size={16} color={searchType === "srcDestStop" ? theme.secondary : theme.textSecondary} />
          },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.searchTypeButton,
              searchType === item.key && styles.searchTypeButtonActive
            ]}
            onPress={() => setSearchType(item.key)}
          >
            <View style={styles.searchTypeIcon}>
              {item.icon}
            </View>
            <Text style={[
              styles.searchTypeLabel,
              searchType === item.key && styles.searchTypeLabelActive
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSearchByBusNumber = () => (
    <View style={styles.inputSection}>
      <View style={styles.card}>
        <View style={styles.busInputWrapper}>
          <Text style={styles.inputLabel}>BUS NUMBER</Text>
          <View style={styles.busNumberInputContainer}>
            <FontAwesome5 name="bus" size={20} color={theme.textTertiary} style={styles.busInputIcon} />
            <TextInput
              style={styles.busNumberInput}
              placeholder="27"
              value={busNumber}
              onChangeText={setBusNumber}
              placeholderTextColor={theme.textTertiary}
              keyboardType="numeric"
              textAlign="center"
              maxLength={4}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const renderSearchBySourceDest = () => (
    <View style={styles.inputSection}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan Your Journey</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>FROM</Text>
          <View style={styles.inputWithIcon}>
            <Ionicons name="location-outline" size={20} color={theme.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="Source"
              value={source}
              onChangeText={setSource}
              placeholderTextColor={theme.textTertiary}
            />
          </View>
        </View>

        <View style={styles.inputSpacer} />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>TO</Text>
          <View style={styles.inputWithIcon}>
            <Ionicons name="location" size={20} color={theme.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="Destination"
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor={theme.textTertiary}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.reverseButton} onPress={handleReverseRoute}>
          <Ionicons name="swap-vertical" size={20} color={theme.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchBySourceDestStop = () => (
    <View style={styles.inputSection}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>JOURNEY WITH STOP</Text>
        <View style={styles.stopsContainer}>
          {[
            { value: source, setter: setSource, placeholder: "Departure Point", label: "FROM", icon: "location-outline" },
            { value: stop, setter: setStop, placeholder: "Intermediate Stop", label: "VIA STOP", icon: "location" },
            { value: destination, setter: setDestination, placeholder: "Final Destination", label: "TO", icon: "flag" },
          ].map((item, index) => (
            <View key={index} style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{item.label}</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name={item.icon} size={20} color={theme.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder={item.placeholder}
                  value={item.value}
                  onChangeText={item.setter}
                  placeholderTextColor={theme.textTertiary}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderSearchButton = () => (
    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
      <TouchableOpacity 
        style={styles.searchButton} 
        onPress={handleFindBus} 
        activeOpacity={0.9}
      >
        <Text style={styles.searchButtonText}>Find Buses</Text>
        <Ionicons name="arrow-forward" size={20} color={theme.secondary} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {renderHeader()}
        {renderSearchTypeSelector()}
        {searchType === "busNo" && renderSearchByBusNumber()}
        {searchType === "srcDest" && renderSearchBySourceDest()}
        {searchType === "srcDestStop" && renderSearchBySourceDestStop()}
        {renderSearchButton()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
  },
  headerSection: {
    marginBottom: 30,
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
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: "500",
  },
  themeToggle: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: theme.uiBackground,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  searchTypeSection: {
    marginBottom: 30,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  searchTypeContainer: {
    flexDirection: 'row',
    backgroundColor: theme.uiBackground,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  searchTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  searchTypeButtonActive: {
    backgroundColor: theme.primary,
  },
  searchTypeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textSecondary,
  },
  searchTypeLabelActive: {
    color: theme.secondary,
  },
  inputSection: {
    marginBottom: 24,
  },
  card: {
    backgroundColor: theme.secondary,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1.5,
    borderColor: theme.border,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.textPrimary,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 1,
  },
  inputField: {
    borderWidth: 2,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingLeft: 46,
    fontSize: 16,
    color: theme.textPrimary,
    backgroundColor: theme.secondary,
    fontWeight: "500",
  },
  inputSpacer: {
    height: 16,
  },
  reverseButton: {
    position: 'absolute',
    right: 24,
    top: '50%',
    marginTop: -20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.primary,
  },
  stopsContainer: {
    gap: 16,
  },
  busInputWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  busNumberInputContainer: {
    borderWidth: 3,
    borderColor: theme.primary,
    borderRadius: 16,
    backgroundColor: theme.secondary,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busInputIcon: {
    position: 'absolute',
    left: 20,
  },
  busNumberInput: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    fontSize: 28,
    fontWeight: "800",
    color: theme.textPrimary,
    backgroundColor: 'transparent',
    textAlign: 'center',
    letterSpacing: 2,
    flex: 1,
  },
  searchButton: {
    backgroundColor: theme.primary,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: theme.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  searchButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.secondary,
  },
});