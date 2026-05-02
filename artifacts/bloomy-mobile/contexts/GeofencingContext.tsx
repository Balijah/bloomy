import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import {
  CACHED_LOCATIONS_KEY,
  GEOFENCING_ENABLED_KEY,
  FarmLocation,
  GeofencingPermissionStatus,
  getGeofencingPermissionStatus,
  isGeofencingStarted,
  requestGeofencingPermissions,
  startGeofencing,
  stopGeofencing,
} from "@/utils/geofencing";

interface GeofencingContextValue {
  /** Current OS location permission level */
  locationPermission: GeofencingPermissionStatus;
  /** Whether the user has toggled geofencing on */
  geofencingEnabled: boolean;
  /** Whether expo-location has actually started the geofencing task */
  geofencingActive: boolean;
  /** Request background location permission */
  requestLocationPermission: () => Promise<void>;
  /** Toggle geofencing on/off (will request permissions if needed) */
  setGeofencingEnabled: (val: boolean) => Promise<void>;
  /** Called by LocationsCacheBridge when location list refreshes */
  updateGeofences: (locations: FarmLocation[]) => Promise<void>;
}

const GeofencingContext = createContext<GeofencingContextValue>({
  locationPermission: "undetermined",
  geofencingEnabled: false,
  geofencingActive: false,
  requestLocationPermission: async () => {},
  setGeofencingEnabled: async () => {},
  updateGeofences: async () => {},
});

export function GeofencingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locationPermission, setLocationPermission] =
    useState<GeofencingPermissionStatus>("undetermined");
  const [geofencingEnabled, setGeofencingEnabledState] = useState(false);
  const [geofencingActive, setGeofencingActive] = useState(false);

  // Initialise from persisted state
  useEffect(() => {
    if (Platform.OS === "web") return;

    async function init() {
      const status = await getGeofencingPermissionStatus();
      setLocationPermission(status);

      const stored = await AsyncStorage.getItem(GEOFENCING_ENABLED_KEY);
      const shouldEnable = stored === "true" && status === "granted";
      setGeofencingEnabledState(shouldEnable);

      if (shouldEnable) {
        const active = await isGeofencingStarted();
        setGeofencingActive(active);
        // Re-register if it somehow stopped
        if (!active) {
          const locRaw = await AsyncStorage.getItem(CACHED_LOCATIONS_KEY);
          if (locRaw) {
            const locs: FarmLocation[] = JSON.parse(locRaw);
            if (locs.length > 0) {
              await startGeofencing(locs);
              setGeofencingActive(await isGeofencingStarted());
            }
          }
        }
      }
    }
    init();
  }, []);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS === "web") return;
    const status = await requestGeofencingPermissions();
    setLocationPermission(status);
  }, []);

  const setGeofencingEnabled = useCallback(
    async (val: boolean) => {
      setGeofencingEnabledState(val);
      await AsyncStorage.setItem(
        GEOFENCING_ENABLED_KEY,
        val ? "true" : "false"
      );

      if (!val) {
        await stopGeofencing();
        setGeofencingActive(false);
        return;
      }

      // Ensure we have background location permission
      if (locationPermission !== "granted") {
        const status = await requestGeofencingPermissions();
        setLocationPermission(status);
        if (status !== "granted") {
          // Permission denied — revert the toggle
          setGeofencingEnabledState(false);
          await AsyncStorage.setItem(GEOFENCING_ENABLED_KEY, "false");
          return;
        }
      }

      // Start geofencing with cached locations
      const locRaw = await AsyncStorage.getItem(CACHED_LOCATIONS_KEY);
      if (locRaw) {
        const locs: FarmLocation[] = JSON.parse(locRaw);
        if (locs.length > 0) {
          await startGeofencing(locs);
        }
      }
      setGeofencingActive(await isGeofencingStarted());
    },
    [locationPermission]
  );

  const updateGeofences = useCallback(
    async (locations: FarmLocation[]) => {
      if (Platform.OS === "web") return;
      // Always cache the latest locations for the background task
      await AsyncStorage.setItem(
        CACHED_LOCATIONS_KEY,
        JSON.stringify(locations)
      );
      // Re-register geofences if the feature is active
      if (geofencingEnabled && locationPermission === "granted" && locations.length > 0) {
        await startGeofencing(locations);
        setGeofencingActive(await isGeofencingStarted());
      }
    },
    [geofencingEnabled, locationPermission]
  );

  return (
    <GeofencingContext.Provider
      value={{
        locationPermission,
        geofencingEnabled,
        geofencingActive,
        requestLocationPermission,
        setGeofencingEnabled,
        updateGeofences,
      }}
    >
      {children}
    </GeofencingContext.Provider>
  );
}

export function useGeofencing() {
  return useContext(GeofencingContext);
}
