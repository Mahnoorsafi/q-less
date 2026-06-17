import { useRef } from 'react';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { COLORS } from './src/constants/theme';

// Auth / onboarding
import SplashScreen1     from './src/screens/SplashScreen1';
import SplashScreen2     from './src/screens/SplashScreen2';
import SplashScreen3     from './src/screens/SplashScreen3';
import Onboarding1       from './src/screens/Onboarding1';
import Onboarding2       from './src/screens/Onboarding2';
import Onboarding3       from './src/screens/Onboarding3';
import LoginScreen       from './src/screens/LoginScreen';
import SignupScreen      from './src/screens/SignupScreen';

// Main screens
import HomeScreen            from './src/screens/HomeScreen';
import HistoryScreen         from './src/screens/HistoryScreen';
import BranchDetailScreen    from './src/screens/BranchDetailScreen';
import MenuScreen            from './src/screens/MenuScreen';
import TokenStatusScreen     from './src/screens/TokenStatusScreen';
import TokenHubScreen        from './src/screens/TokenHubScreen';
import PreScheduleScreen     from './src/screens/PreScheduleScreen';
import RescheduleScreen      from './src/screens/RescheduleScreen';
import NotificationScreen    from './src/screens/NotificationScreen';
import ProfileScreen         from './src/screens/ProfileScreen';
import SettingsScreen        from './src/screens/SettingsScreen';
import AboutScreen           from './src/screens/AboutScreen';
import PreBookHomeScreen     from './src/screens/PreBookHomeScreen';
import MapScreen             from './src/screens/MapScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();
const HomeStack     = createNativeStackNavigator();
const HistoryStack  = createNativeStackNavigator();
const TokenStack    = createNativeStackNavigator();
const PreBookStack  = createNativeStackNavigator();
const ProfileStack  = createNativeStackNavigator();

// ── Tab icons ──────────────────────────────────────────────────────────────────

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 2, width: 70 }}>
      <View style={{
        width: 52,
        height: 28,
        borderRadius: 14,
        backgroundColor: focused ? COLORS.primaryBg : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 3,
      }}>
        <Text style={{ fontSize: 19, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          fontSize: 10,
          fontWeight: focused ? '800' : '500',
          color: focused ? COLORS.primary : COLORS.textMuted,
          textAlign: 'center',
          width: '100%',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Nested stack navigators (bottom tab bar always visible) ───────────────────

function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain"       component={HomeScreen} />
      <HomeStack.Screen name="BranchDetail"   component={BranchDetailScreen} />
      <HomeStack.Screen name="Menu"           component={MenuScreen} />
      <HomeStack.Screen name="TokenStatus"    component={TokenStatusScreen} />
      <HomeStack.Screen name="PreSchedule"    component={PreScheduleScreen} />
      <HomeStack.Screen name="Reschedule"     component={RescheduleScreen} />
      <HomeStack.Screen name="Notifications"  component={NotificationScreen} />
      <HomeStack.Screen name="Map"            component={MapScreen} />
    </HomeStack.Navigator>
  );
}

function HistoryStackNav() {
  return (
    <HistoryStack.Navigator screenOptions={{ headerShown: false }}>
      <HistoryStack.Screen name="HistoryMain"  component={HistoryScreen} />
      <HistoryStack.Screen name="TokenStatus"  component={TokenStatusScreen} />
      <HistoryStack.Screen name="Notifications" component={NotificationScreen} />
    </HistoryStack.Navigator>
  );
}

function TokenStackNav() {
  return (
    <TokenStack.Navigator screenOptions={{ headerShown: false }}>
      <TokenStack.Screen name="TokenHub"    component={TokenHubScreen} />
      <TokenStack.Screen name="BranchDetail" component={BranchDetailScreen} />
      <TokenStack.Screen name="TokenStatus"  component={TokenStatusScreen} />
      <TokenStack.Screen name="PreSchedule"  component={PreScheduleScreen} />
      <TokenStack.Screen name="Reschedule"   component={RescheduleScreen} />
      <TokenStack.Screen name="Notifications" component={NotificationScreen} />
    </TokenStack.Navigator>
  );
}

function PreBookStackNav() {
  return (
    <PreBookStack.Navigator screenOptions={{ headerShown: false }}>
      <PreBookStack.Screen name="PreBookHome"     component={PreBookHomeScreen} />
      <PreBookStack.Screen name="PreScheduleMain" component={PreScheduleScreen} />
      <PreBookStack.Screen name="TokenStatus"     component={TokenStatusScreen} />
      <PreBookStack.Screen name="Reschedule"      component={RescheduleScreen} />
      <PreBookStack.Screen name="Notifications"   component={NotificationScreen} />
    </PreBookStack.Navigator>
  );
}

function ProfileStackNav() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain"  component={ProfileScreen} />
      <ProfileStack.Screen name="Settings"     component={SettingsScreen} />
      <ProfileStack.Screen name="About"        component={AboutScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationScreen} />
    </ProfileStack.Navigator>
  );
}

// ── Main tab navigator ─────────────────────────────────────────────────────────

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 4,
        },
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNav}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏡" label="Home"     focused={focused} />,
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNav}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🕐" label="History"  focused={focused} />,
        }}
      />
      <Tab.Screen
        name="TokenTab"
        component={TokenStackNav}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎫" label="Token"    focused={focused} />,
        }}
      />
      <Tab.Screen
        name="PreBookTab"
        component={PreBookStackNav}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗓️" label="PreBook" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNav}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🧑" label="Profile"  focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root navigator ─────────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={user ? 'MainTabs' : 'Splash1'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash1"     component={SplashScreen1} />
      <Stack.Screen name="Splash2"     component={SplashScreen2} />
      <Stack.Screen name="Splash3"     component={SplashScreen3} />
      <Stack.Screen name="Onboarding1" component={Onboarding1} />
      <Stack.Screen name="Onboarding2" component={Onboarding2} />
      <Stack.Screen name="Onboarding3" component={Onboarding3} />
      <Stack.Screen name="Login"       component={LoginScreen} />
      <Stack.Screen name="Signup"      component={SignupScreen} />
      <Stack.Screen name="MainTabs"    component={MainTabs} />
    </Stack.Navigator>
  );
}

export default function App() {
  const navigationRef = useRef<any>(null);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider navigationRef={navigationRef}>
          <NavigationContainer ref={navigationRef}>
            <AppRoutes />
          </NavigationContainer>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});