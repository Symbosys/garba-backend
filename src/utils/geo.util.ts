/**
 * Calculate the great-circle distance between two points on the Earth's surface (in meters)
 * using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_METERS = 6371000; // Earth's mean radius in meters

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
}

export interface GeofenceMatchResult {
  isWithinGeofence: boolean;
  matchedGeofenceId: string | null;
  matchedGeofenceName: string | null;
  distanceMeters: number | null;
  nearestGeofenceDistanceMeters: number | null;
  nearestGeofenceName: string | null;
}

export interface CheckableGeofence {
  id: string;
  name: string;
  latitude: number | string | any;
  longitude: number | string | any;
  radiusMeters: number;
}

/**
 * Validates whether given coordinates fall within any of the provided geofence boundaries.
 */
export function evaluateGeofences(
  latitude: number,
  longitude: number,
  geofences: CheckableGeofence[]
): GeofenceMatchResult {
  if (!geofences || geofences.length === 0) {
    return {
      isWithinGeofence: false,
      matchedGeofenceId: null,
      matchedGeofenceName: null,
      distanceMeters: null,
      nearestGeofenceDistanceMeters: null,
      nearestGeofenceName: null,
    };
  }

  let nearestDistance: number | null = null;
  let nearestName: string | null = null;

  for (const gf of geofences) {
    const gfLat = typeof gf.latitude === "number" ? gf.latitude : Number(gf.latitude);
    const gfLon = typeof gf.longitude === "number" ? gf.longitude : Number(gf.longitude);
    const radius = Number(gf.radiusMeters) || 100;

    const distance = calculateDistanceMeters(latitude, longitude, gfLat, gfLon);

    if (nearestDistance === null || distance < nearestDistance) {
      nearestDistance = distance;
      nearestName = gf.name;
    }

    if (distance <= radius) {
      return {
        isWithinGeofence: true,
        matchedGeofenceId: gf.id,
        matchedGeofenceName: gf.name,
        distanceMeters: distance,
        nearestGeofenceDistanceMeters: distance,
        nearestGeofenceName: gf.name,
      };
    }
  }

  return {
    isWithinGeofence: false,
    matchedGeofenceId: null,
    matchedGeofenceName: null,
    distanceMeters: null,
    nearestGeofenceDistanceMeters: nearestDistance,
    nearestGeofenceName: nearestName,
  };
}
