import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";

interface WeatherIconProps {
  code: number;
  isDay?: boolean;
  size?: number;
  color?: string;
}

function getIconConfig(code: number, isDay: boolean): { lib: "ionicons" | "mci"; name: string } {
  if (code === 0) {
    return isDay
      ? { lib: "ionicons", name: "sunny" }
      : { lib: "ionicons", name: "moon" };
  }
  if (code <= 2) {
    return isDay
      ? { lib: "ionicons", name: "partly-sunny" }
      : { lib: "ionicons", name: "cloudy-night" };
  }
  if (code === 3) return { lib: "ionicons", name: "cloudy" };
  if (code === 45 || code === 48) return { lib: "mci", name: "weather-fog" };
  if (code >= 51 && code <= 57) return { lib: "ionicons", name: "rainy" };
  if (code >= 61 && code <= 67) return { lib: "ionicons", name: "rainy" };
  if (code >= 71 && code <= 77) return { lib: "ionicons", name: "snow" };
  if (code >= 80 && code <= 82) return { lib: "ionicons", name: "rainy" };
  if (code >= 85 && code <= 86) return { lib: "ionicons", name: "snow" };
  if (code >= 95 && code <= 99) return { lib: "ionicons", name: "thunderstorm" };
  return { lib: "ionicons", name: "partly-sunny" };
}

export function WeatherIcon({ code, isDay = true, size = 24, color = "#333" }: WeatherIconProps) {
  const config = getIconConfig(code, isDay);
  if (config.lib === "mci") {
    return <MaterialCommunityIcons name={config.name as any} size={size} color={color} />;
  }
  return <Ionicons name={config.name as any} size={size} color={color} />;
}
