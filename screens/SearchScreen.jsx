// screens/SearchScreen.js
import React, { useState } from "react";
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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";

export default function SearchScreen() {
  const navigation = useNavigation();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const [searchType, setSearchType] = useState("srcDest");
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [stop, setStop] = useState("");
  const [busNumber, setBusNumber] = useState("");
  const [busPreview, setBusPreview] = useState(null);

  const styles = createStyles(theme);

  // Reverse source and destination
  const handleReverseRoute = () => {
    const temp = source;
    setSource(destination);
    setDestination(temp);
  };

  // Fetch bus preview when bus number is entered
  const handleBusNumberChange = async (text) => {
    setBusNumber(text);
    
    if (text.trim() && text.length >= 1) {
      try {
        const response = await fetch(`https://yus.kwscloud.in/yus/get-route?bus_id=${text.trim()}`);
        const data = await response.json();
        
        if (data.route_id !== 0 && data.bus_id !== 0) {
          setBusPreview(data);
        } else {
          setBusPreview(null);
        }
      } catch (error) {
        console.error("Bus preview error:", error);
        setBusPreview(null);
      }
    } else {
      setBusPreview(null);
    }
  };

  const handleFindBus = async () => {
    try {
      let url = "";

      if (searchType === "srcDest") {
        if (!source.trim() || !destination.trim()) {
          Alert.alert("Missing Fields", "Please enter both source and destination.");
          return;
        }
        url = `https://yus.kwscloud.in/yus/src-${source.trim()}&dest-${destination.trim()}`;
      } 
      else if (searchType === "srcDestStop") {
        if (!source.trim() || !destination.trim() || !stop.trim()) {
          Alert.alert("Missing Fields", "Please enter source, destination, and stop.");
          return;
        }
        url = `https://yus.kwscloud.in/yus/src-${source.trim()}&dest-${destination.trim()}&stop-${stop.trim()}`;
      } 
      else if (searchType === "busNo") {
        if (!busNumber.trim()) {
          Alert.alert("Missing Field", "Please enter bus number.");
          return;
        }
        url = `https://yus.kwscloud.in/yus/get-route?bus_id=${busNumber.trim()}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (searchType === "busNo") {
        if (data.route_id === 0 && data.bus_id === 0) {
          Alert.alert("Not Found", "No bus found with this number.");
          return;
        }
        navigation.navigate("BusList", { 
          buses: [data], 
          searchType: "busNo",
          busNumber: busNumber 
        });
      } else {
        if (!data || data === 'null' || (Array.isArray(data) && data.length === 0)) {
          Alert.alert("Not Found", "No buses found for your search criteria.");
          return;
        }
        navigation.navigate("BusList", { 
          buses: data, 
          searchType,
          source,
          destination,
          stop: searchType === "srcDestStop" ? stop : null
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert("Error", "Failed to search for buses. Please try again.");
    }
  };

  // Professional header section
  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.headerRow}>
        <Text style={styles.appTitle}>BusBuddy</Text>
        <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
          <Text style={styles.themeToggleText}>
            {isDarkMode ? "☀️" : "🌙"}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.spotSection}>
        <View style={styles.spotRow}>
          <Text style={styles.spotLabel}>BUS</Text>
          <Text style={styles.spotValue}>ROUTE</Text>
        </View>
      </View>
    </View>
  );

  // Professional search type selector
  const renderSearchTypeSelector = () => (
    <View style={styles.searchTypeSection}>
      <Text style={styles.sectionTitle}>Q. Find Buses</Text>
      
      <View style={styles.searchTypeGrid}>
        <TouchableOpacity 
          style={[
            styles.searchTypeCard,
            searchType === "srcDest" && styles.searchTypeCardActive
          ]}
          onPress={() => setSearchType("srcDest")}
        >
          <Text style={styles.searchTypeEmoji}>📍</Text>
          <Text style={[
            styles.searchTypeLabel,
            searchType === "srcDest" && styles.searchTypeLabelActive
          ]}>
            Source → Destination
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.searchTypeCard,
            searchType === "srcDestStop" && styles.searchTypeCardActive
          ]}
          onPress={() => setSearchType("srcDestStop")}
        >
          <Text style={styles.searchTypeEmoji}>🛑</Text>
          <Text style={[
            styles.searchTypeLabel,
            searchType === "srcDestStop" && styles.searchTypeLabelActive
          ]}>
            Source → Stop → Dest
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.searchTypeCard,
            searchType === "busNo" && styles.searchTypeCardActive
          ]}
          onPress={() => setSearchType("busNo")}
        >
          <Text style={styles.searchTypeEmoji}>🚍</Text>
          <Text style={[
            styles.searchTypeLabel,
            searchType === "busNo" && styles.searchTypeLabelActive
          ]}>
            Bus Number
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Source → Destination with reverse functionality
  const renderSearchBySourceDest = () => (
    <View style={styles.inputSection}>
      <View style={styles.routeVisual}>
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>FROM</Text>
          <Text style={styles.routeValue}>{source || "Source"}</Text>
        </View>
        
        <TouchableOpacity style={styles.reverseButton} onPress={handleReverseRoute}>
          <Text style={styles.reverseIcon}>⇄</Text>
        </TouchableOpacity>
        
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>TO</Text>
          <Text style={styles.routeValue}>{destination || "Destination"}</Text>
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>SOURCE</Text>
          <TextInput
            style={styles.input}
            placeholder="Sattur"
            value={source}
            onChangeText={setSource}
            placeholderTextColor={theme.textLight}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>DESTINATION</Text>
          <TextInput
            style={styles.input}
            placeholder="Kcet"
            value={destination}
            onChangeText={setDestination}
            placeholderTextColor={theme.textLight}
          />
        </View>
      </View>
    </View>
  );

  const renderSearchBySourceDestStop = () => (
    <View style={styles.inputSection}>
      <View style={styles.routeVisual}>
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>FROM</Text>
          <Text style={styles.routeValue}>{source || "Source"}</Text>
        </View>
        
        <TouchableOpacity style={styles.reverseButton} onPress={handleReverseRoute}>
          <Text style={styles.reverseIcon}>⇄</Text>
        </TouchableOpacity>
        
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>TO</Text>
          <Text style={styles.routeValue}>{destination || "Destination"}</Text>
        </View>
      </View>

      <View style={styles.inputGrid}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>SOURCE</Text>
          <TextInput
            style={styles.input}
            placeholder="Kcet"
            value={source}
            onChangeText={setSource}
            placeholderTextColor={theme.textLight}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>STOP</Text>
          <TextInput
            style={styles.input}
            placeholder="Soolakrai"
            value={stop}
            onChangeText={setStop}
            placeholderTextColor={theme.textLight}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>DESTINATION</Text>
          <TextInput
            style={styles.input}
            placeholder="Kovilpatti"
            value={destination}
            onChangeText={setDestination}
            placeholderTextColor={theme.textLight}
          />
        </View>
      </View>
    </View>
  );

  const renderSearchByBusNumber = () => (
    <View style={styles.inputSection}>
      <View style={styles.busNumberHeader}>
        <Text style={styles.busNumberTitle}>SPOT BUS</Text>
        <Text style={styles.busNumberSubtitle}>Enter Bus Number</Text>
      </View>
      
      <View style={styles.busInputContainer}>
        <Text style={styles.busInputLabel}>BUS NO</Text>
        <TextInput
          style={styles.busInput}
          placeholder="27"
          value={busNumber}
          onChangeText={handleBusNumberChange}
          placeholderTextColor={theme.textLight}
          keyboardType="numeric"
          textAlign="center"
        />
      </View>
      
      {busPreview && (
        <View style={styles.busPreview}>
          <Text style={styles.busPreviewTitle}>Bus #{busPreview.bus_id}</Text>
          <Text style={styles.busPreviewRoute}>{busPreview.route_name}</Text>
          <Text style={styles.busPreviewDirection}>
            {busPreview.direction === "UP" ? "🔼" : "🔽"} {busPreview.src} → {busPreview.dest}
          </Text>
          <Text style={styles.busPreviewStops}>
            {busPreview.stops?.length || 0} stops • {busPreview.stops?.[0]?.departure_time} - {busPreview.stops?.[busPreview.stops?.length - 1]?.arrival_time}
          </Text>
        </View>
      )}
    </View>
  );

  // Bus-shaped button
  const renderBusButton = () => (
    <TouchableOpacity style={styles.busButton} onPress={handleFindBus}>
      <View style={styles.busBody}>
        <Text style={styles.busButtonText}>FIND BUS</Text>
      </View>
      <View style={styles.busWheels}>
        <View style={styles.wheel} />
        <View style={styles.wheel} />
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {renderHeader()}
        {renderSearchTypeSelector()}
        
        {searchType === "srcDest" && renderSearchBySourceDest()}
        {searchType === "srcDestStop" && renderSearchBySourceDestStop()}
        {searchType === "busNo" && renderSearchByBusNumber()}

        {renderBusButton()}
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
    padding: 16,
  },
  headerSection: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.primary,
  },
  themeToggle: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.primary,
  },
  themeToggleText: {
    fontSize: 18,
    color: theme.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 8,
  },
  spotSection: {
    padding: 12,
    backgroundColor: theme.isDarkMode ? '#1a1a1a' : '#f8f9fa',
    borderRadius: 8,
  },
  spotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spotLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.textLight,
  },
  spotValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: theme.primary,
  },
  searchTypeSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.textDark,
    marginBottom: 16,
  },
  searchTypeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  searchTypeCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.secondary,
  },
  searchTypeCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '20',
  },
  searchTypeEmoji: {
    fontSize: 20,
    marginBottom: 8,
  },
  searchTypeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textDark,
    textAlign: 'center',
  },
  searchTypeLabelActive: {
    color: theme.primary,
    fontWeight: "bold",
  },
  inputSection: {
    marginBottom: 24,
  },
  routeVisual: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  routePoint: {
    alignItems: 'center',
    flex: 1,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.textLight,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: theme.textDark,
    textAlign: 'center',
  },
  reverseButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: theme.primary,
    marginHorizontal: 15,
  },
  reverseIcon: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGrid: {
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: theme.textDark,
    backgroundColor: theme.secondary,
  },
  busNumberHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  busNumberTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.primary,
    textTransform: 'uppercase',
  },
  busNumberSubtitle: {
    fontSize: 14,
    color: theme.textLight,
    marginTop: 4,
  },
  busInputContainer: {
    alignItems: 'center',
  },
  busInputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textLight,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  busInput: {
    borderWidth: 2,
    borderColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 24,
    fontWeight: "bold",
    color: theme.textDark,
    backgroundColor: theme.secondary,
    width: 120,
    textAlign: 'center',
  },
  busPreview: {
    marginTop: 20,
    padding: 16,
    backgroundColor: theme.primary + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  busPreviewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.primary,
    marginBottom: 4,
  },
  busPreviewRoute: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.textDark,
    marginBottom: 4,
  },
  busPreviewDirection: {
    fontSize: 14,
    color: theme.textLight,
    marginBottom: 4,
  },
  busPreviewStops: {
    fontSize: 12,
    color: theme.textLight,
  },
  // Bus-shaped button styles
  busButton: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  busBody: {
    backgroundColor: theme.primary,
    width: 200,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  busButtonText: {
    color: theme.secondary,
    fontSize: 18,
    fontWeight: "bold",
  },
  busWheels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 160,
    marginTop: -8,
  },
  wheel: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.textDark,
  },
});