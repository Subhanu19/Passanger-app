// Image URL (uploaded file):
// /mnt/data/WhatsApp Image 2025-11-23 at 6.36.05 PM.jpeg

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
import { LinearGradient } from "expo-linear-gradient"; // used only for the golden gradient button

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
          {/* <Text style={styles.appTitle}>YELLOH BUS</Text>
          <Text style={styles.appSubtitle}>Plan your journey effortlessly</Text> */}
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
      <View style={{ marginTop: 100 }} />
      <Text style={styles.sectionLabel}>Choose Search Method</Text>
      <View style={styles.searchTypeContainer}>
        {[
          { 
            key: "srcDest", 
            label: "DIRECT", 
            icon: <MaterialIcons name="route" size={16} color={searchType === "srcDest" ? "#5a3a00" : theme.textSecondary} />
          },
           { 
            key: "busNo", 
            label: "BUS NO", 
            icon: <FontAwesome5 name="bus" size={14} color={searchType === "busNo" ? "#5a3a00" : theme.textSecondary} />
          },
          // { 
          //   key: "srcDestStop", 
          //   label: "VIA STOP", 
          //   icon: <FontAwesome5 name="map-marker-alt" size={14} color={searchType === "srcDestStop" ? "#5a3a00" : theme.textSecondary} />
          // },
        ].map((item, idx) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.searchTypeButton,
              searchType === item.key && styles.searchTypeButtonActive,
              // add left / right rounding for extreme buttons to create a pill segmented look
              idx === 0 && styles.leftSegment,
              idx === 2 && styles.rightSegment
            ]}
            onPress={() => setSearchType(item.key)}
            activeOpacity={0.9}
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
    <View style={styles.journeyCard}>
      
      <View style={styles.journeyHeaderRow}>
        <Ionicons name="search-outline" size={20} color="#000" />
        <Text style={styles.journeyTitle}>Plan Your Journey</Text>
      </View>

      {/* FROM + icon + TO */}
      <View style={styles.journeyInputsRow}>

        {/* FROM */}
        <View style={styles.journeyInputBlock}>
          <Text style={styles.journeyLabel}>FROM</Text>
          <View style={styles.journeyInputBox}>
            <TextInput
              style={styles.journeyInput}
              placeholder="Source"
              value={source}
              onChangeText={setSource}
              placeholderTextColor="#777"
            />
          </View>
        </View>

        {/* >> */}
        <Text style={styles.journeyArrow}>{'>>'}</Text>

        {/* TO */}
        <View style={styles.journeyInputBlock}>
          <Text style={styles.journeyLabel}>TO</Text>
          <View style={styles.journeyInputBox}>
            <TextInput
              style={styles.journeyInput}
              placeholder="Destination"
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor="#777"
            />
          </View>
        </View>

      </View>
    </View>
  </View>
);


  // const renderSearchBySourceDest = () => (
  //   <View style={styles.inputSection}>
  //     <View style={styles.card}>
  //       <Text style={styles.cardTitle}>Plan Your Journey</Text>
        
  //       <View style={styles.inputGroup}>
  //         <Text style={styles.inputLabel}>FROM</Text>
  //         <View style={styles.inputWithIcon}>
  //           <Ionicons name="location-outline" size={20} color={theme.textTertiary} style={styles.inputIcon} />
  //           <TextInput
  //             style={styles.inputField}
  //             placeholder="Source"
  //             value={source}
  //             onChangeText={setSource}
  //             placeholderTextColor={theme.textTertiary}
  //           />
  //         </View>
  //       </View>

  //       <View style={styles.inputSpacer} />

  //       <View style={styles.inputGroup}>
  //         <Text style={styles.inputLabel}>TO</Text>
  //         <View style={styles.inputWithIcon}>
  //           <Ionicons name="location" size={20} color={theme.textTertiary} style={styles.inputIcon} />
  //           <TextInput
  //             style={styles.inputField}
  //             placeholder="Destination"
  //             value={destination}
  //             onChangeText={setDestination}
  //             placeholderTextColor={theme.textTertiary}
  //           />
  //         </View>
  //       </View>

  //       <TouchableOpacity style={styles.reverseButton} onPress={handleReverseRoute}>
  //         <Ionicons name="swap-vertical" size={20} color="#5a3a00" />
  //       </TouchableOpacity>
  //     </View>
  //   </View>
  // );

  // const renderSearchBySourceDestStop = () => (
  //   <View style={styles.inputSection}>
  //     <View style={styles.card}>
  //       <Text style={styles.cardTitle}>JOURNEY WITH STOP</Text>
  //       <View style={styles.stopsContainer}>
  //         {[
  //           { value: source, setter: setSource, placeholder: "Departure Point", label: "FROM", icon: "location-outline" },
  //           { value: stop, setter: setStop, placeholder: "Intermediate Stop", label: "VIA STOP", icon: "location" },
  //           { value: destination, setter: setDestination, placeholder: "Final Destination", label: "TO", icon: "flag" },
  //         ].map((item, index) => (
  //           <View key={index} style={styles.inputGroup}>
  //             <Text style={styles.inputLabel}>{item.label}</Text>
  //             <View style={styles.inputWithIcon}>
  //               <Ionicons name={item.icon} size={20} color={theme.textTertiary} style={styles.inputIcon} />
  //               <TextInput
  //                 style={styles.inputField}
  //                 placeholder={item.placeholder}
  //                 value={item.value}
  //                 onChangeText={item.setter}
  //                 placeholderTextColor={theme.textTertiary}
  //               />
  //             </View>
  //           </View>
  //         ))}
  //       </View>
  //     </View>
  //   </View>
  // );

  const renderSearchButton = () => (
    <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
      <TouchableOpacity 
        style={styles.searchButtonOuter}
        onPress={handleFindBus} 
        activeOpacity={0.9}
      >
        {/* golden gradient */}
        <LinearGradient
          start={[0, 0]}
          end={[1, 0]}
          colors={["#f3c156ff", "#f1b21a"]}
          style={styles.searchButtonGradient}
        >
          <Text style={styles.searchButtonText}>Find Buses</Text>
          <Ionicons name="rocket" size={18} color="#000" style={{ marginLeft: 8 }} />
        </LinearGradient>
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
        {/* {searchType === "srcDestStop" && renderSearchBySourceDestStop()} */}
        {renderSearchButton()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme) => {
  // Fixed golden palette for Option A
  const GOLD_START = "#edae25ff";
  const GOLD_END = "#f1b21a";
  const GOLD_DARK = "#c98a00";
  const GLASS_BG = "rgba(255,255,255,0.88)"; // soft glass card
  const CARD_BORDER = "rgba(255, 255, 255, 0.6)";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background, // keep app background controlled by theme
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 20,
      paddingTop: 60,
    },
    headerSection: {
      marginBottom: 26,
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
      fontSize: 34,
      fontWeight: "900",
      // gold-ish text with subtle shadow to mimic embossed gold
      color: GOLD_START,
      textShadowColor: "rgba(0,0,0,0.08)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
      letterSpacing: -1,
    },
    appSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: "600",
      marginTop: 6,
    },
    themeToggle: {
      padding: 10,
      borderRadius: 24,
      backgroundColor: GLASS_BG,
      borderWidth: 0.8,
      borderColor: "rgba(0,0,0,0.06)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },

    // --- Search Type (Segmented) ---
    searchTypeSection: {
      marginBottom: 24,
    },
    sectionLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 12,
      textAlign: 'center',
    },
    searchTypeContainer: {
      flexDirection: 'row',
      backgroundColor: GLASS_BG,
      borderRadius: 40,
      padding: 6,
      borderWidth: 1,
      borderColor: CARD_BORDER,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    searchTypeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 30,
      gap: 8,
      zIndex: 2,
    },
    leftSegment: {
      borderTopLeftRadius: 30,
      borderBottomLeftRadius: 30,
    },
    rightSegment: {
      borderTopRightRadius: 30,
      borderBottomRightRadius: 30,
    },
    searchTypeButtonActive: {
      backgroundColor: GOLD_START,
      borderWidth: 0,
      shadowColor: GOLD_DARK,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 5,
    },
    searchTypeIcon: {
      marginRight: 6,
    },
    searchTypeLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.textSecondary,
      letterSpacing: 0.6,
    },
    searchTypeLabelActive: {
      color: "#5a3a00",
    },

    // Inputs & Cards (glass)
    inputSection: {
      marginBottom: 18,
    },
    card: {
      backgroundColor: GLASS_BG,
      borderRadius: 18,
      padding: 22,
      borderWidth: 1,
      borderColor: CARD_BORDER,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
      elevation: 6,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: "#222",
      marginBottom: 18,
      textAlign: 'center',
    },
    inputGroup: {
      marginBottom: 10,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    inputWithIcon: {
      position: 'relative',
    },
    inputIcon: {
      position: 'absolute',
      left: 14,
      top: 15,
      zIndex: 2,
      opacity: 0.85,
    },
    inputField: {
      borderWidth: 2,
      borderColor: "rgba(0,0,0,0.06)",
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      paddingLeft: 46,
      fontSize: 16,
      color: theme.textPrimary,
      backgroundColor: "rgba(255,255,255,0.95)",
      fontWeight: "600",
    },
    inputSpacer: {
      height: 14,
    },
    reverseButton: {
      position: 'absolute',
      right: 20,
      top: '50%',
      marginTop: -22,
      padding: 10,
      borderRadius: 12,
      backgroundColor: GOLD_START,
      shadowColor: GOLD_DARK,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 4,
    },
    stopsContainer: {
      gap: 12,
    },
    busInputWrapper: {
      alignItems: 'center',
      width: '100%',
    },
    busNumberInputContainer: {
      borderWidth: 3,
      borderColor: "#f2d18b",
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.95)",
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
    busInputIcon: {
      position: 'absolute',
      left: 20,
      top: 18,
      opacity: 0.9,
    },
    busNumberInput: {
      paddingVertical: 18,
      paddingHorizontal: 40,
      fontSize: 28,
      fontWeight: "900",
      color: "#222",
      backgroundColor: 'transparent',
      textAlign: 'center',
      letterSpacing: 2,
      flex: 1,
    },

    // search button
    searchButtonOuter: {
      borderRadius: 28,
      overflow: "hidden",
      marginTop: 14,
      marginBottom: 28,
      alignSelf: "center",
      width: "100%",
      maxWidth: 420,
      shadowColor: GOLD_DARK,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 8,
    },
    searchButtonGradient: {
      paddingVertical: 18,
      paddingHorizontal: 26,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },
    searchButtonText: {
      fontSize: 18,
      fontWeight: "800",
      color: "#000",
      marginRight: 8,
      textShadowColor: "rgba(0,0,0,0.08)",
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 6,
    },
    journeyCard: {
  backgroundColor: "#ffffff",
  padding: 26,
  borderRadius: 22,
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
},

journeyHeaderRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 22,
  gap: 10,
},

journeyTitle: {
  fontSize: 20,
  fontWeight: "800",
  color: "#000",
},

journeyInputsRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},

journeyInputBlock: {
  flex: 1,
},

journeyLabel: {
  fontSize: 12,
  fontWeight: "700",
  color: "#555",
  marginBottom: 8,
  textAlign: "center",
},

journeyInputBox: {
  borderWidth: 2,
  borderColor: "#f0c876",
  borderRadius: 14,
  paddingVertical: 14,
  paddingHorizontal: 16,
  backgroundColor: "#fff",
  alignItems: "center",
},

journeyInput: {
  fontSize: 16,
  fontWeight: "600",
  color: "#222",
  textAlign: "center",
},

journeyArrow: {
  marginBottom:-28,
  marginHorizontal: 12,
  fontSize: 22,
  fontWeight: "900",
  color: "#444",
},

  });
};
