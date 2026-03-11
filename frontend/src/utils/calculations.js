/**
 * Client-side mirror of the Python math engine.
 * Used for live preview in the NewSession form.
 * Must stay in exact sync with backend/engine/*.py
 */

// ── V1 Legacy Functions (kept for backward compatibility) ──

export function computeComposite(s1, s2, s3, tweetWithin6h, weights = [0.40, 0.35, 0.25]) {
  const [w1, w2, w3] = weights;
  const r = (s1 * w1) + (s2 * w2) + (s3 * w3);
  const rAdj = tweetWithin6h ? r * 1.5 : r;
  return Math.max(rAdj, 0);
}

export function bayesianUpdate(pMarket, rAdj, k = 10) {
  const alpha = pMarket * k;
  const beta = (1.0 - pMarket) * k;
  const deltaYes = rAdj * 5.0;
  const deltaNo = Math.max((1.0 - rAdj) * 2.0, 0);
  const denom = alpha + beta + deltaYes + deltaNo;
  if (denom === 0) return 0.5;
  return (alpha + deltaYes) / denom;
}

export function computeKelly(pModel, yesPrice, noPrice, kellyDivisor = 1.0, thresholds = [25, 12, 8]) {
  const priceSum = yesPrice + noPrice;
  if (priceSum === 0) return { kellyFraction: 0, edgePp: 0, signal: 'PASS' };

  const pMarket = yesPrice / priceSum;
  const edgePp = (pModel - pMarket) * 100;

  let fYes = 0;
  if (yesPrice > 0 && yesPrice < 1) {
    const bYes = (1 - yesPrice) / yesPrice;
    fYes = (bYes * pModel - (1 - pModel)) / bYes;
  }

  let fNo = 0;
  if (noPrice > 0 && noPrice < 1) {
    const bNo = (1 - noPrice) / noPrice;
    fNo = (bNo * (1 - pModel) - pModel) / bNo;
  }

  const fYesAdj = Math.max(fYes / kellyDivisor, 0);
  const fNoAdj = Math.max(fNo / kellyDivisor, 0);

  const [strongTh, longTh, watchTh] = thresholds;

  if (fNoAdj > 0 && edgePp < -watchTh) {
    return { kellyFraction: fNoAdj, edgePp, signal: 'SHORT' };
  } else if (edgePp >= strongTh) {
    return { kellyFraction: fYesAdj, edgePp, signal: 'STRONG_LONG' };
  } else if (edgePp >= longTh) {
    return { kellyFraction: fYesAdj, edgePp, signal: 'LONG' };
  } else if (edgePp >= watchTh) {
    return { kellyFraction: fYesAdj, edgePp, signal: 'WATCH' };
  } else {
    return { kellyFraction: fYesAdj, edgePp, signal: 'PASS' };
  }
}

// ── V2 Bias Computation ──

const DEFAULT_AUDIENCE_MULTIPLIERS = {
  rally: 1.15,
  press_conference: 0.90,
  interview: 0.95,
  speech: 1.05,
  debate: 1.10,
  social_media: 1.00,
};

export function computeBiases({
  eventType = null,
  controversyScore = 0,
  daysInNewsCycle = 1,
  breakingNewsCount = 0,
  socialPostsCount = 0,
  repetitionCount = 0,
  repetitionWindow = 5,
  // Settings
  repetitionBiasEnabled = true,
  audienceBiasEnabled = true,
  escalationBiasEnabled = true,
  newsReactivityBiasEnabled = true,
  platformPrimingBiasEnabled = true,
  repetitionBoost = 0.3,
  escalationRate = 0.05,
  reactivityCoefficient = 0.15,
  primingBoost = 0.1,
  audienceMultipliers = null,
} = {}) {
  const biases = {};

  // Repetition bias
  if (repetitionBiasEnabled && repetitionWindow > 0) {
    biases.repetition = 1.0 + repetitionBoost * (repetitionCount / repetitionWindow);
  } else {
    biases.repetition = 1.0;
  }

  // Audience bias
  if (audienceBiasEnabled && eventType) {
    let multipliers = DEFAULT_AUDIENCE_MULTIPLIERS;
    if (audienceMultipliers) {
      try {
        multipliers = typeof audienceMultipliers === 'string'
          ? JSON.parse(audienceMultipliers) : audienceMultipliers;
      } catch { /* use defaults */ }
    }
    biases.audience = multipliers[eventType.toLowerCase()] || 1.0;
  } else {
    biases.audience = 1.0;
  }

  // Escalation bias
  if (escalationBiasEnabled && controversyScore > 0) {
    biases.escalation = 1.0 + escalationRate * controversyScore * Math.min(daysInNewsCycle, 7);
  } else {
    biases.escalation = 1.0;
  }

  // News reactivity bias
  if (newsReactivityBiasEnabled && breakingNewsCount > 0) {
    biases.newsReactivity = 1.0 + reactivityCoefficient * (breakingNewsCount / 5);
  } else {
    biases.newsReactivity = 1.0;
  }

  // Platform priming bias
  if (platformPrimingBiasEnabled && socialPostsCount > 0) {
    biases.platformPriming = 1.0 + Math.min(primingBoost * socialPostsCount, 0.4);
  } else {
    biases.platformPriming = 1.0;
  }

  biases.total = biases.repetition * biases.audience * biases.escalation
    * biases.newsReactivity * biases.platformPriming;

  return biases;
}

// ── V2 Composite Signal (7 signals) ──

export function computeCompositeV2({
  s1, s2, s3, s4 = null, s5 = null, s6 = null, s7 = null,
  weights = [0.25, 0.20, 0.15, 0.15, 0.10, 0.08, 0.07],
  biasTotal = 1.0,
} = {}) {
  const signals = [s1, s2, s3, s4, s5, s6, s7];
  const w = weights.length >= 7 ? weights.slice(0, 7) : [
    ...weights.slice(0, 3),
    0.15, 0.10, 0.08, 0.07,
  ];

  let activeWeight = 0;
  let inactiveWeight = 0;
  for (let i = 0; i < 7; i++) {
    if (signals[i] != null) activeWeight += w[i];
    else inactiveWeight += w[i];
  }

  if (activeWeight === 0) return 0;

  const scale = inactiveWeight > 0 ? (activeWeight + inactiveWeight) / activeWeight : 1.0;

  let rRaw = 0;
  for (let i = 0; i < 7; i++) {
    if (signals[i] != null) rRaw += signals[i] * w[i] * scale;
  }

  return Math.max(rRaw * biasTotal, 0);
}

// ── V2 Bayesian Update ──

export function bayesianUpdateV2({
  pMarket, rAdj,
  baseRate = null, kBase = 5, wBase = 0.3,
  kMarket = 10,
  yesPseudo = 5.0, noPseudo = 2.0,
  hoursSinceSignals = 0, decayHalfLife = 24.0,
  calibrationFactor = 1.0,
} = {}) {
  // Stage 1: Combined prior
  let alpha, beta, pBaseUsed;
  if (baseRate != null && wBase > 0) {
    const wMarket = 1.0 - wBase;
    alpha = wBase * (baseRate * kBase) + wMarket * (pMarket * kMarket);
    beta = wBase * ((1.0 - baseRate) * kBase) + wMarket * ((1.0 - pMarket) * kMarket);
    pBaseUsed = baseRate;
  } else {
    alpha = pMarket * kMarket;
    beta = (1.0 - pMarket) * kMarket;
    pBaseUsed = null;
  }

  // Stage 2: Signal update with confidence
  const confidence = Math.min(rAdj, 1.0);
  let deltaYes = rAdj * confidence * yesPseudo;
  let deltaNo = Math.max((1.0 - rAdj) * noPseudo, 0);

  // Stage 3: Time decay
  if (hoursSinceSignals > 0 && decayHalfLife > 0) {
    const decay = Math.exp(-Math.LN2 * hoursSinceSignals / decayHalfLife);
    deltaYes *= decay;
    deltaNo *= decay;
  }

  // Posterior
  const denom = alpha + beta + deltaYes + deltaNo;
  let pRaw = denom === 0 ? 0.5 : (alpha + deltaYes) / denom;

  // Stage 4: Calibration
  let pModel;
  if (calibrationFactor < 1.0) {
    pModel = pRaw * calibrationFactor + (1.0 - calibrationFactor) * 0.5;
  } else {
    pModel = pRaw;
  }

  return { pModel, confidence, pBaseRate: pBaseUsed };
}

// ── V2 S5 Source Proximity ──

export function computeS5SourceProximity(sourceHoursAgo, halfLifeHours = 6.0, relevance = 1.0) {
  if (sourceHoursAgo == null) return null;
  if (halfLifeHours <= 0) return relevance;
  const lam = Math.LN2 / halfLifeHours;
  return relevance * Math.exp(-lam * sourceHoursAgo);
}

// ── V1 Entry Point (legacy) ──

export function runFullAnalysis(yesPrice, noPrice, s1, s2, s3, tweetWithin6h, settings = {}) {
  const weights = settings.weights || [0.40, 0.35, 0.25];
  const k = settings.k_value || 10;
  const kellyDivisor = settings.kelly_divisor || 1.0;
  const thresholds = settings.thresholds || [25, 12, 8];

  const priceSum = yesPrice + noPrice;
  const pMarket = priceSum > 0 ? yesPrice / priceSum : 0.5;
  const rAdj = computeComposite(s1, s2, s3, tweetWithin6h, weights);
  const pModel = bayesianUpdate(pMarket, rAdj, k);
  const kelly = computeKelly(pModel, yesPrice, noPrice, kellyDivisor, thresholds);

  return {
    pMarket: Math.round(pMarket * 10000) / 10000,
    rAdj: Math.round(rAdj * 10000) / 10000,
    pModel: Math.round(pModel * 10000) / 10000,
    edgePp: Math.round(kelly.edgePp * 100) / 100,
    kellyFraction: Math.round(kelly.kellyFraction * 10000) / 10000,
    signal: kelly.signal,
  };
}

// ── V2 Entry Point (full pipeline) ──

export function runFullAnalysisV2({
  yesPrice, noPrice, s1, s2, s3,
  tweetWithin6h = false,
  s4 = null, s5 = null, s6 = null, s7 = null,
  // Bias inputs
  eventType = null, controversyScore = 0,
  breakingNewsCount = 0, socialPostsCount = 0,
  sourceHoursAgo = null,
  // Settings
  settings = {},
} = {}) {
  const w1 = settings.s1_weight ?? 0.40;
  const w2 = settings.s2_weight ?? 0.35;
  const w3 = settings.s3_weight ?? 0.25;
  const k = settings.k_value ?? 10;
  const kellyDivisor = settings.kelly_divisor ?? 1.0;
  const thresholds = [
    settings.strong_edge_threshold ?? 25,
    settings.long_edge_threshold ?? 12,
    settings.watch_edge_threshold ?? 8,
  ];

  const priceSum = yesPrice + noPrice;
  const pMarket = priceSum > 0 ? yesPrice / priceSum : 0.5;

  // Determine V2 mode
  const v2Mode = s4 != null || s5 != null || s6 != null || s7 != null
    || eventType != null || controversyScore > 0 || breakingNewsCount > 0
    || socialPostsCount > 0 || sourceHoursAgo != null;

  let rAdj, pModel, biasTotal, confidence, pBaseRate;

  if (v2Mode) {
    // Compute S5 if needed
    if (s5 == null && sourceHoursAgo != null) {
      s5 = computeS5SourceProximity(sourceHoursAgo, settings.source_half_life ?? 6.0);
    } else if (s5 == null && tweetWithin6h) {
      s5 = 1.0;
    }

    // Compute biases
    const biases = computeBiases({
      eventType,
      controversyScore,
      breakingNewsCount,
      socialPostsCount,
      repetitionBiasEnabled: settings.repetition_bias_enabled ?? true,
      audienceBiasEnabled: settings.audience_bias_enabled ?? true,
      escalationBiasEnabled: settings.escalation_bias_enabled ?? true,
      newsReactivityBiasEnabled: settings.news_reactivity_bias_enabled ?? true,
      platformPrimingBiasEnabled: settings.platform_priming_bias_enabled ?? true,
      repetitionBoost: settings.repetition_boost ?? 0.3,
      escalationRate: settings.escalation_rate ?? 0.05,
      reactivityCoefficient: settings.reactivity_coefficient ?? 0.15,
      primingBoost: settings.priming_boost ?? 0.1,
      audienceMultipliers: settings.audience_multipliers,
    });
    biasTotal = biases.total;

    // 7-signal composite
    const fullWeights = [
      w1, w2, w3,
      settings.s4_weight ?? 0.15,
      settings.s5_weight ?? 0.10,
      settings.s6_weight ?? 0.08,
      settings.s7_weight ?? 0.07,
    ];
    rAdj = computeCompositeV2({ s1, s2, s3, s4, s5, s6, s7, weights: fullWeights, biasTotal });

    // Multi-layer Bayesian
    const bayes = bayesianUpdateV2({
      pMarket, rAdj,
      kMarket: k,
      kBase: settings.k_base ?? 5,
      wBase: settings.w_base ?? 0.3,
      yesPseudo: settings.yes_pseudo ?? 5.0,
      noPseudo: settings.no_pseudo ?? 2.0,
      decayHalfLife: settings.decay_half_life ?? 24.0,
      calibrationFactor: settings.calibration_factor ?? 1.0,
    });
    pModel = bayes.pModel;
    confidence = bayes.confidence;
    pBaseRate = bayes.pBaseRate;
  } else {
    // V1 legacy path
    rAdj = computeComposite(s1, s2, s3, tweetWithin6h, [w1, w2, w3]);
    pModel = bayesianUpdate(pMarket, rAdj, k);
    biasTotal = 1.0;
    confidence = Math.min(rAdj, 1.0);
    pBaseRate = null;
  }

  const kelly = computeKelly(pModel, yesPrice, noPrice, kellyDivisor, thresholds);

  return {
    pMarket: Math.round(pMarket * 10000) / 10000,
    rAdj: Math.round(rAdj * 10000) / 10000,
    pModel: Math.round(pModel * 10000) / 10000,
    edgePp: Math.round(kelly.edgePp * 100) / 100,
    kellyFraction: Math.round(kelly.kellyFraction * 10000) / 10000,
    signal: kelly.signal,
    biasTotal: Math.round(biasTotal * 10000) / 10000,
    confidence: Math.round(confidence * 10000) / 10000,
    pBaseRate,
  };
}
