import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { Colors } from '@/constants/Colors';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';

// ─── Slide visuals ────────────────────────────────────────────────────────────

function WelcomeVisual() {
  return (
    <View style={vis.wrap}>
      {/* Outer glow ring */}
      <View style={vis.goldRing} />
      {/* Player dot */}
      <View style={vis.playerDot} />
      {/* Orbiting obstacles */}
      <View style={[vis.ob, { top: 18,  left: '22%', width: 18, height: 18, borderRadius: 9,  backgroundColor: '#FF4444' }]} />
      <View style={[vis.ob, { top: 26,  right: '18%', width: 14, height: 14, borderRadius: 7, backgroundColor: '#4488FF' }]} />
      <View style={[vis.ob, { bottom: 22, left: '18%', width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF44CC' }]} />
      <View style={[vis.ob, { bottom: 18, right: '20%', width: 16, height: 16, borderRadius: 8, backgroundColor: '#44CCFF' }]} />
      <View style={[vis.ob, { top: '40%', left: 12,  width: 10, height: 10, borderRadius: 5,  backgroundColor: '#FFAA44' }]} />
      <View style={[vis.ob, { top: '35%', right: 14,  width: 13, height: 13, borderRadius: 7,  backgroundColor: '#88FF44' }]} />
    </View>
  );
}

function HowToPlayVisual() {
  return (
    <View style={vis.wrap}>
      {/* Mock game field */}
      <View style={vis.field}>
        {/* Player dot (left) */}
        <View style={vis.fieldPlayer} />
        {/* Dashed motion line */}
        <View style={vis.motionLine} />
        {/* Ghost target (right) */}
        <View style={vis.fieldTarget} />
        {/* Tap ripple */}
        <View style={vis.tapRing} />
        {/* Finger emoji above target */}
        <Text style={vis.fingerEmoji}>👆</Text>
        {/* Obstacles */}
        <View style={[vis.fieldOb, { top: 8,  left: 12, backgroundColor: '#FF4444' }]} />
        <View style={[vis.fieldOb, { bottom: 8, right: 10, backgroundColor: '#4488FF' }]} />
        <View style={[vis.fieldOb, { top: 12, right: 40, backgroundColor: '#FF8844', width: 10, height: 10, borderRadius: 5 }]} />
      </View>
      {/* Legend */}
      <View style={vis.legend}>
        <View style={vis.legendRow}><View style={vis.legendDot} /><Text style={vis.legendText}>Your dot</Text></View>
        <View style={vis.legendRow}><Text style={vis.legendArrow}>→</Text><Text style={vis.legendText}>Move to tap position</Text></View>
      </View>
    </View>
  );
}

function ChaosModeVisual() {
  const obs = [
    { top: 8,   left: 20,  w: 18, c: '#FF4444' },
    { top: 14,  right: 18, w: 14, c: '#FF6600' },
    { top: 38,  left: 8,   w: 12, c: '#FF2288' },
    { top: 30,  right: 10, w: 16, c: '#FF4444' },
    { bottom: 10, left: 14, w: 20, c: '#FF6600' },
    { bottom: 18, right: 16, w: 14, c: '#FF4444' },
    { top: '40%', left: '40%', w: 12, c: '#FF2222' },
    { bottom: 30, left: '35%', w: 10, c: '#FF8844' },
    { top: 10, left: '45%', w: 16, c: '#FF4466' },
  ];
  return (
    <View style={vis.wrap}>
      <View style={[vis.field, vis.chaosField]}>
        {/* Timer text */}
        <Text style={vis.chaosTimer}>0:20</Text>
        {/* Explosion */}
        <Text style={vis.chaosEmoji}>💥</Text>
        {/* Scattered obstacles */}
        {obs.map((o, i) => (
          <View
            key={i}
            style={[
              vis.fieldOb,
              {
                top: o.top as any, left: o.left as any,
                right: o.right as any, bottom: o.bottom as any,
                width: o.w, height: o.w, borderRadius: o.w / 2,
                backgroundColor: o.c,
              },
            ]}
          />
        ))}
      </View>
      <Text style={vis.chaosSubLabel}>⚡  All patterns unlocked simultaneously</Text>
    </View>
  );
}

function CompeteVisual() {
  const rows = [
    { pos: '🥇', name: 'KingOfKings',  score: '312s', gold: true  },
    { pos: '🥈', name: 'DodgeLegend',  score: '287s', gold: false },
    { pos: '🥉', name: 'Survivor99',   score: '231s', gold: false },
    { pos: '★',  name: 'YOU',          score: '???',  gold: true, me: true },
  ];
  return (
    <View style={vis.wrap}>
      <View style={vis.leaderboard}>
        {rows.map((r, i) => (
          <View key={i} style={[vis.lbRow, r.me && vis.lbRowMe]}>
            <Text style={vis.lbPos}>{r.pos}</Text>
            <Text style={[vis.lbName, r.gold && { color: Colors.gold }]}>{r.name}</Text>
            <Text style={[vis.lbScore, r.gold && { color: Colors.gold }]}>{r.score}</Text>
          </View>
        ))}
      </View>
      <Text style={vis.competeLabel}>👑  King of Kings awaits</Text>
    </View>
  );
}

// ─── Slide data ───────────────────────────────────────────────────────────────

interface SlideData {
  Visual: React.ComponentType;
  title: string;
  body: string;
  accentColor: string;
}

const SLIDES: SlideData[] = [
  {
    Visual: WelcomeVisual,
    title: 'WELCOME TO\nDODGE MASTER',
    body: 'The ultimate survival challenge.\nHow long can you last?',
    accentColor: Colors.gold,
  },
  {
    Visual: HowToPlayVisual,
    title: 'HOW TO PLAY',
    body: 'Tap anywhere to teleport your dot instantly.\nHold and drag to glide continuously.\n\nAvoid every single obstacle.',
    accentColor: Colors.gold,
  },
  {
    Visual: ChaosModeVisual,
    title: 'CHAOS MODE',
    body: 'Survive 20 seconds and chaos ERUPTS.\nNew patterns. Faster obstacles. Homing.\nBouncing. Spiralling. All at once.',
    accentColor: Colors.danger,
  },
  {
    Visual: CompeteVisual,
    title: 'COMPETE\nGLOBALLY',
    body: 'Climb global and weekly leaderboards.\nEarn badges and streak rewards.\nBecome the King of Kings.',
    accentColor: Colors.gold,
  },
];

// ─── Slide component ──────────────────────────────────────────────────────────

function Slide({ item, width }: { item: SlideData; width: number }) {
  const { Visual, title, body, accentColor } = item;
  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.visualWrap}>
        <Visual />
      </View>
      <Text style={[styles.slideTitle, { color: accentColor, textShadowColor: accentColor }]}>
        {title}
      </Text>
      <Text style={styles.slideBody}>{body}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completing, setCompleting]     = useState(false);
  const listRef = useRef<FlatList<SlideData>>(null);

  // Must be stable refs to avoid FlatList warning
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 51 });
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const idx = viewableItems[0]?.index;
      if (idx != null) setCurrentIndex(idx);
    },
  );

  const finish = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { onboardingComplete: true }, { merge: true });
      } catch {}
    }
    router.replace('/');
  }, [completing, user]);

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      finish();
    }
  }, [currentIndex, finish]);

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>

      {/* Skip — fixed top-right */}
      <View style={styles.topBar}>
        <View />
        <TouchableOpacity onPress={finish} style={styles.skipBtn} disabled={completing}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <Slide item={item} width={screenWidth} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        style={styles.list}
        getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
      />

      {/* Bottom bar — dots + next button */}
      <View style={styles.bottomBar}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex && styles.dotActive,
                i < currentIndex  && styles.dotPast,
              ]}
            />
          ))}
        </View>

        {/* Next / LET'S PLAY button */}
        <TouchableOpacity
          style={[styles.nextBtn, isLast && styles.nextBtnFinal]}
          onPress={handleNext}
          disabled={completing}
          activeOpacity={0.8}
        >
          {completing ? (
            <ActivityIndicator color={Colors.background} size="small" />
          ) : (
            <Text style={[styles.nextBtnText, isLast && styles.nextBtnTextFinal]}>
              {isLast ? "LET'S PLAY!" : 'Next  →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Visual sub-styles ────────────────────────────────────────────────────────

const vis = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },

  // Slide 1 — Welcome
  goldRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  playerDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 28,
    shadowOpacity: 1,
    elevation: 20,
  },
  ob: {
    position: 'absolute',
  },

  // Slide 2 — How to Play
  field: {
    width: 260,
    height: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    position: 'relative',
  },
  fieldPlayer: {
    position: 'absolute',
    left: 30,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    shadowOpacity: 1,
  },
  motionLine: {
    position: 'absolute',
    left: 55,
    top: '50%',
    marginTop: -1,
    width: 110,
    height: 2,
    backgroundColor: 'rgba(255,215,0,0.3)',
    borderStyle: 'dashed',
  },
  fieldTarget: {
    position: 'absolute',
    right: 38,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.25)',
    borderWidth: 1.5,
    borderColor: Colors.gold,
  },
  tapRing: {
    position: 'absolute',
    right: 28,
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  fingerEmoji: {
    position: 'absolute',
    right: 32,
    top: 8,
    fontSize: 22,
  },
  fieldOb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legend: { flexDirection: 'row', gap: 20 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.gold },
  legendArrow: { fontSize: 14, color: 'rgba(255,215,0,0.6)' },
  legendText: { fontSize: 11, color: Colors.textSecondary },

  // Slide 3 — Chaos
  chaosField: {
    borderColor: 'rgba(255,60,60,0.4)',
    backgroundColor: 'rgba(255,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chaosTimer: {
    position: 'absolute',
    top: 8,
    left: 12,
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '900',
    letterSpacing: 2,
  },
  chaosEmoji: {
    fontSize: 42,
    textShadowColor: Colors.danger,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  chaosSubLabel: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '600',
    opacity: 0.8,
    letterSpacing: 0.5,
  },

  // Slide 4 — Compete
  leaderboard: {
    width: 260,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  lbRowMe: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderBottomWidth: 0,
  },
  lbPos:   { fontSize: 18, width: 28 },
  lbName:  { flex: 1, fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  lbScore: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  competeLabel: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.85,
  },
});

// ─── Main styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  skipText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },

  list: { flex: 1 },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  visualWrap: {
    width: '100%',
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: 3,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  slideBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  bottomBar: {
    paddingHorizontal: 28,
    paddingBottom: 28,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  dotPast: {
    backgroundColor: 'rgba(255,215,0,0.45)',
    borderColor: 'transparent',
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
    borderColor: 'transparent',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: 1,
  },

  nextBtn: {
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.gold,
  },
  nextBtnFinal: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
    paddingHorizontal: 28,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    shadowOpacity: 0.6,
    elevation: 8,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 1,
  },
  nextBtnTextFinal: {
    color: Colors.background,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
