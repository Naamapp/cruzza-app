import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function SplashScreen() {
  const scaleAnim = new Animated.Value(0.5);
  const opacityAnim = new Animated.Value(0);
  const translateYAnim = new Animated.Value(50);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={['#4f46e5', '#7c3aed', '#ec4899']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>C</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: opacityAnim,
            transform: [{ translateY: translateYAnim }],
          },
        ]}
      >
        <Text style={styles.title}>cruzza</Text>
        <Text style={styles.subtitle}>PREMIUM RIDES</Text>
      </Animated.View>

      <View style={styles.dotsContainer}>
        {[0, 1, 2].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                opacity: opacityAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                transform: [
                  {
                    translateY: opacityAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -10],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 32,
  },
  logoBox: {
    width: 112,
    height: 112,
    backgroundColor: 'white',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    transform: [{ rotate: '3deg' }],
  },
  logoText: {
    fontSize: 56,
    fontWeight: '800',
    color: '#4f46e5',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 64,
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    backgroundColor: 'white',
    borderRadius: 5,
  },
});
