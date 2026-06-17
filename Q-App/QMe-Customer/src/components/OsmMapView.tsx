import { useMemo } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Linking, ViewStyle } from 'react-native';
import { COLORS, FONT } from '../constants/theme';

export type OsmMarker = {
  lat: number;
  lng: number;
  title?: string;
  color?: string;
};

type Props = {
  lat: number;
  lng: number;
  zoom?: number;
  markers?: OsmMarker[];
  height?: number;
  flex?: boolean;
  interactive?: boolean;
  userLat?: number;
  userLng?: number;
};

let WebView: any = null;
if (Platform.OS !== 'web') {
  try { WebView = require('react-native-webview').WebView; } catch {}
}

function buildHtml(
  lat: number, lng: number, zoom: number,
  markers: OsmMarker[], interactive: boolean,
  userLat?: number, userLng?: number,
): string {
  const markersJson = JSON.stringify(
    markers.map((m) => ({ lat: m.lat, lng: m.lng, title: m.title ?? '', color: m.color ?? '#2D6A2E' }))
  );
  const userJson = (userLat != null && userLng != null)
    ? JSON.stringify({ lat: userLat, lng: userLng })
    : 'null';

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;font-family:sans-serif}
  .dir-btn{
    display:block;width:100%;margin-top:6px;padding:6px 10px;
    background:#2D6A2E;color:#fff;border:none;border-radius:6px;
    font-size:13px;font-weight:600;cursor:pointer;text-align:center
  }
  .popup-title{font-weight:700;font-size:14px;color:#0f172a;margin-bottom:2px}
  .popup-meta{font-size:12px;color:#64748b}
</style>
</head><body>
<div id="map"></div>
<script>
var markers = ${markersJson};
var userPos = ${userJson};
var interactive = ${String(interactive)};

var map = L.map('map', {
  zoomControl: interactive,
  dragging: interactive,
  scrollWheelZoom: interactive,
  doubleClickZoom: interactive,
  touchZoom: interactive,
}).setView([${lat}, ${lng}], ${zoom});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

function makeIcon(color, name) {
  var label = '<div style="position:relative;display:inline-block;text-align:center">'
    + '<div style="width:26px;height:26px;background:' + color + ';border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);margin:0 auto"></div>'
    + '<div style="margin-top:3px;background:' + color + ';color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">' + name + '</div>'
    + '</div>';
  return L.divIcon({
    className: '',
    html: label,
    iconSize: [80, 52],
    iconAnchor: [40, 26],
    popupAnchor: [0, -30],
  });
}

markers.forEach(function(m) {
  var parts = m.title.split(' — ');
  var name = parts[0] || m.title;
  var meta = parts[1] || '';
  var userLat = userPos ? userPos.lat : null;
  var userLng = userPos ? userPos.lng : null;

  var popupHtml = '<div class="popup-title">' + name + '</div>';
  if (meta) popupHtml += '<div class="popup-meta">' + meta + '</div>';
  if (userLat !== null) {
    popupHtml += '<button class="dir-btn" onclick="getDir(' + m.lat + ',' + m.lng + ',' + userLat + ',' + userLng + ')">📍 Get Directions</button>';
  } else {
    popupHtml += '<button class="dir-btn" onclick="getDir(' + m.lat + ',' + m.lng + ',null,null)">📍 View on Map</button>';
  }

  L.marker([m.lat, m.lng], { icon: makeIcon(m.color, name) })
    .addTo(map)
    .bindPopup(popupHtml);
});

if (userPos) {
  L.circleMarker([userPos.lat, userPos.lng], {
    radius: 8,
    fillColor: '#1E88E5',
    fillOpacity: 0.9,
    color: '#ffffff',
    weight: 3,
  }).addTo(map).bindPopup('<div class="popup-title">You are here</div>');
}

function getDir(toLat, toLng, fromLat, fromLng) {
  var msg;
  if (fromLat !== null) {
    msg = 'directions://' + fromLat + ',' + fromLng + '//' + toLat + ',' + toLng;
  } else {
    msg = 'view://' + toLat + ',' + toLng;
  }
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(msg);
  }
}
</script>
</body></html>`;
}

export default function OsmMapView({
  lat, lng, zoom = 14, markers, height = 180,
  flex = false, interactive = false, userLat, userLng,
}: Props) {
  const allMarkers: OsmMarker[] = markers ?? [{ lat, lng }];
  const containerStyle: ViewStyle = flex ? { flex: 1 } : { height };

  const html = useMemo(
    () => buildHtml(lat, lng, zoom, allMarkers, interactive, userLat, userLng),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lng, zoom, interactive, userLat, userLng, JSON.stringify(allMarkers)],
  );

  function openGoogleMaps() {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {});
  }

  function handleMessage(event: any) {
    const msg: string = event.nativeEvent.data ?? '';
    if (msg.startsWith('directions://')) {
      const parts = msg.replace('directions://', '').split('//');
      const [from, to] = parts;
      Linking.openURL(`https://www.google.com/maps/dir/${from}/${to}`).catch(() => {});
    } else if (msg.startsWith('view://')) {
      const coords = msg.replace('view://', '');
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords}`).catch(() => {});
    }
  }

  if (Platform.OS === 'web' || !WebView) {
    return (
      <TouchableOpacity style={[styles.fallback, containerStyle]} onPress={openGoogleMaps} activeOpacity={0.85}>
        <Text style={styles.fallbackEmoji}>🗺️</Text>
        <Text style={styles.fallbackLabel}>Open in Google Maps</Text>
        <Text style={styles.fallbackCoords}>{lat.toFixed(4)}°N  {lng.toFixed(4)}°E</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyle}>
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fallbackEmoji:  { fontSize: 36 },
  fallbackLabel:  { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textPrimary },
  fallbackCoords: { fontSize: FONT.xs, color: COLORS.textSecondary },
});
