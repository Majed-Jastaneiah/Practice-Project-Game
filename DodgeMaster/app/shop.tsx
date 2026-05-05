import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { COIN_VALUES, IAP_PACKAGES } from '@/constants/Coins';
import { useCoins } from '@/hooks/useCoins';
import { CoinDisplay } from '@/components/CoinDisplay';
import { Button } from '@/components/Button';

export default function ShopScreen() {
  const { coins, add } = useCoins();
  const [adLoading, setAdLoading] = useState(false);

  // Placeholder: simulate watching an ad and rewarding coins
  const handleWatchAd = async () => {
    setAdLoading(true);
    // TODO: integrate real ad SDK (e.g. AdMob via expo-ads-admob or react-native-google-mobile-ads)
    await new Promise((r) => setTimeout(r, 1500));
    await add(COIN_VALUES.AD_WATCH_REWARD);
    setAdLoading(false);
    Alert.alert('Thanks!', `You earned ${COIN_VALUES.AD_WATCH_REWARD} coins.`);
  };

  // Placeholder: simulate an IAP purchase
  const handleBuyPackage = (pkg: (typeof IAP_PACKAGES)[number]) => {
    // TODO: integrate real IAP (expo-iap or react-native-purchases)
    Alert.alert(
      'Purchase (Coming Soon)',
      `${pkg.priceLabel} for ${pkg.coins} coins.\nIAP will be available in a future update.`,
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SHOP</Text>
        <CoinDisplay amount={coins} size="small" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Free coins section ── */}
        <Text style={styles.sectionTitle}>FREE COINS</Text>

        <TouchableOpacity
          style={styles.adCard}
          onPress={handleWatchAd}
          activeOpacity={0.75}
          disabled={adLoading}
        >
          <View style={styles.adLeft}>
            <Text style={styles.adIcon}>📺</Text>
            <View>
              <Text style={styles.adTitle}>Watch an Ad</Text>
              <Text style={styles.adSub}>Short video • Skip after 5s</Text>
            </View>
          </View>
          <View style={styles.reward}>
            {adLoading ? (
              <Text style={styles.adLoadingText}>Loading…</Text>
            ) : (
              <CoinDisplay amount={COIN_VALUES.AD_WATCH_REWARD} size="small" />
            )}
          </View>
        </TouchableOpacity>

        {/* ── IAP packages ── */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>
          BUY COINS
        </Text>

        {IAP_PACKAGES.map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            style={styles.packageCard}
            onPress={() => handleBuyPackage(pkg)}
            activeOpacity={0.75}
          >
            <CoinDisplay amount={pkg.coins} size="medium" />
            <Text style={styles.packagePrice}>{pkg.priceLabel}</Text>
          </TouchableOpacity>
        ))}

        {/* ── Info footer ── */}
        <Text style={styles.footer}>
          Coins are used to revive mid-game.{'\n'}
          Earn free coins by hitting score milestones{'\n'}or logging in daily.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  back: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 4,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 4,
    color: Colors.textSecondary,
    fontWeight: '700',
    marginBottom: 4,
  },
  adCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  adLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  adIcon: {
    fontSize: 28,
  },
  adTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  adSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  reward: {
    alignItems: 'flex-end',
  },
  adLoadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gold,
  },
  footer: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 28,
    opacity: 0.7,
  },
});
