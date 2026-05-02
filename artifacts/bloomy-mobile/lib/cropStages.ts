/**
 * Crop phenology stages keyed by GDD (Growing Degree Days) accumulation.
 *
 * Each crop type defines an ordered array of stages. The "current" stage is the
 * last one whose `gddMin` the accumulated GDD has reached or exceeded. Progress
 * within a stage is computed as a 0–1 fraction between its gddMin and gddMax.
 */

export interface CropStage {
  key: string;
  name: string;
  /** Ionicons icon name */
  icon: string;
  /** GDD required to enter this stage */
  gddMin: number;
  /** GDD at which the NEXT stage begins (used for within-stage progress) */
  gddMax: number;
  /** One-sentence description of what's happening in the plant */
  description: string;
  /** 2–4 concrete tasks the grower should focus on */
  keyTasks: string[];
}

// ── Crop stage maps ────────────────────────────────────────────────────────────

const CORN_STAGES: CropStage[] = [
  {
    key: "germination",
    name: "Germination & Emergence",
    icon: "leaf-outline",
    gddMin: 0,
    gddMax: 120,
    description: "Seeds are absorbing moisture and the radicle is pushing toward the soil surface.",
    keyTasks: [
      "Ensure adequate soil moisture for uniform germination",
      "Check for soil crusting that may impede emergence",
      "Scout for seedling diseases and early insect pressure",
    ],
  },
  {
    key: "vegetative",
    name: "Vegetative Growth",
    icon: "cellular-outline",
    gddMin: 120,
    gddMax: 800,
    description: "Rapid leaf development is underway; the plant is building its photosynthetic engine through V1–V10 stages.",
    keyTasks: [
      "Side-dress nitrogen if not pre-applied",
      "Control weeds before canopy closure at V5–V6",
      "Scout for rootworm, aphids, and grey leaf spot",
      "Evaluate stand count and replant if needed",
    ],
  },
  {
    key: "tasseling",
    name: "Tasseling & Silking",
    icon: "flower-outline",
    gddMin: 800,
    gddMax: 1100,
    description: "Tassels are emerging and pollen is shedding; silks are receptive — this is the critical pollination window.",
    keyTasks: [
      "Avoid any spray applications that may harm pollinators",
      "Monitor soil moisture — water stress during pollination cuts yield",
      "Scout for corn earworm egg masses on silks",
      "Check for tar spot and northern corn leaf blight",
    ],
  },
  {
    key: "grain_fill",
    name: "Grain Fill",
    icon: "nutrition-outline",
    gddMin: 1100,
    gddMax: 1600,
    description: "Kernels are rapidly accumulating starch and protein through blister, milk, dough, and dent stages.",
    keyTasks: [
      "Maintain soil moisture — 2–3\" of water per week ideal",
      "Scout for stalk rots, which weaken standability",
      "Monitor for late-season aphid colonies reducing yield",
      "Plan harvest logistics as black layer (maturity) approaches",
    ],
  },
  {
    key: "maturity",
    name: "Physiological Maturity",
    icon: "checkmark-circle-outline",
    gddMin: 1600,
    gddMax: 2000,
    description: "Black layer has formed at the kernel tip — maximum dry matter is set and the crop is ready to harvest at the right moisture.",
    keyTasks: [
      "Test grain moisture — harvest at 25–30% to reduce field losses",
      "Evaluate stalk integrity and prioritise lodging-prone fields",
      "Scout for ear moulds before harvest",
      "Arrange storage and drying capacity",
    ],
  },
];

const SOYBEANS_STAGES: CropStage[] = [
  {
    key: "germination",
    name: "Germination & Emergence",
    icon: "leaf-outline",
    gddMin: 0,
    gddMax: 100,
    description: "Hypocotyl is arching and cotyledons are emerging above the soil surface.",
    keyTasks: [
      "Check for uniform stand — replant threshold is ~75,000 plants/acre",
      "Watch for seedling diseases (Pythium, Phytophthora) in wet soils",
      "Scout for bean leaf beetle and slug damage",
    ],
  },
  {
    key: "vegetative",
    name: "Vegetative Growth",
    icon: "cellular-outline",
    gddMin: 100,
    gddMax: 600,
    description: "Trifoliate leaves are expanding through V1–V6; the plant is establishing its canopy and root nodules.",
    keyTasks: [
      "Control broadleaf and grass weeds before V3",
      "Evaluate nodulation — roots should show pink nodules by V2",
      "Apply foliar fungicide if white mould pressure is high",
      "Scout for Japanese beetle defoliation",
    ],
  },
  {
    key: "flowering",
    name: "Flowering",
    icon: "flower-outline",
    gddMin: 600,
    gddMax: 900,
    description: "R1–R2: white to purple flowers are opening; pod set is determined during this stage.",
    keyTasks: [
      "Maintain irrigation — drought at R1 dramatically reduces pod set",
      "Apply fungicide for frogeye leaf spot and white mould if warranted",
      "Scout for defoliating insects (don't exceed 30% defoliation at R1)",
      "Avoid spraying during peak pollinator activity",
    ],
  },
  {
    key: "pod_fill",
    name: "Pod Fill",
    icon: "nutrition-outline",
    gddMin: 900,
    gddMax: 1200,
    description: "R3–R6: pods are growing, seeds are swelling, and oil and protein are being deposited.",
    keyTasks: [
      "Maintain soil moisture — R5 is the most yield-sensitive period",
      "Scout for pod-feeding stink bugs and bean pod mottle virus vectors",
      "Monitor for sudden death syndrome symptoms",
      "Plan harvest equipment calibration",
    ],
  },
  {
    key: "maturity",
    name: "Maturity",
    icon: "checkmark-circle-outline",
    gddMin: 1200,
    gddMax: 1500,
    description: "R7–R8: leaves are yellowing and dropping; pods are rattling — the crop is ready to harvest.",
    keyTasks: [
      "Harvest at ≤14% seed moisture to avoid quality loss",
      "Adjust combine settings to minimise pod shatter",
      "Scout for green stem syndrome that can delay harvest",
    ],
  },
];

const WINTER_WHEAT_STAGES: CropStage[] = [
  {
    key: "germination",
    name: "Germination & Emergence",
    icon: "leaf-outline",
    gddMin: 0,
    gddMax: 100,
    description: "Seeds are imbibing water and the coleoptile is pushing through the soil.",
    keyTasks: [
      "Verify uniform emergence and plant population",
      "Scout for Hessian fly and wheat curl mite",
      "Apply pre-emergence herbicide if winter annuals are a concern",
    ],
  },
  {
    key: "tillering",
    name: "Tillering & Vernalisation",
    icon: "cellular-outline",
    gddMin: 100,
    gddMax: 500,
    description: "The plant is developing tillers and accumulating the cold exposure needed for spring flowering.",
    keyTasks: [
      "Apply fall nitrogen to support tiller development",
      "Control broadleaf weeds with post-emerge herbicide",
      "Scout for aphids that can vector barley yellow dwarf virus",
    ],
  },
  {
    key: "jointing",
    name: "Jointing & Stem Extension",
    icon: "arrow-up-outline",
    gddMin: 500,
    gddMax: 700,
    description: "Jointing (Feekes 6) marks rapid stem elongation — the first node is now detectable.",
    keyTasks: [
      "Apply final spring nitrogen topdress",
      "Scout for powdery mildew and stripe rust",
      "Evaluate tiller survival and yield potential",
    ],
  },
  {
    key: "heading",
    name: "Heading & Flowering",
    icon: "flower-outline",
    gddMin: 700,
    gddMax: 900,
    description: "Heads are emerging and anthers are shedding pollen — Fusarium head blight infection window is open.",
    keyTasks: [
      "Apply fungicide for head blight if >10% flowering coincides with rain",
      "Scout for cereal aphids on flag leaf and head",
      "Monitor for stripe rust and leaf rust progression",
    ],
  },
  {
    key: "maturity",
    name: "Grain Fill & Maturity",
    icon: "checkmark-circle-outline",
    gddMin: 900,
    gddMax: 1200,
    description: "Kernels are filling; the crop transitions from soft dough to hard ripe — ready to harvest.",
    keyTasks: [
      "Harvest when grain moisture is 13–14%",
      "Watch for lodging caused by late-season diseases",
      "Plan combine ground speed to minimise shatter losses",
    ],
  },
];

const COTTON_STAGES: CropStage[] = [
  {
    key: "germination",
    name: "Germination & Emergence",
    icon: "leaf-outline",
    gddMin: 0,
    gddMax: 150,
    description: "Cotyledons are unfolding above the soil; the hypocotyl arch straightens.",
    keyTasks: [
      "Ensure soil temp ≥65°F to avoid chilling injury",
      "Scout for thrips — the most critical early pest",
      "Apply pre-emergence herbicide to clean seedbed",
    ],
  },
  {
    key: "vegetative",
    name: "Vegetative Growth",
    icon: "cellular-outline",
    gddMin: 150,
    gddMax: 500,
    description: "True leaves are expanding; the main stem is adding a new node approximately every 3 days.",
    keyTasks: [
      "Control early-season weeds aggressively",
      "Monitor for fleahoppers and plant bugs",
      "Regulate growth with mepiquat chloride if excessive rankness",
    ],
  },
  {
    key: "squaring",
    name: "Squaring",
    icon: "square-outline",
    gddMin: 500,
    gddMax: 800,
    description: "First squares (flower buds) are forming — the yield framework is being built.",
    keyTasks: [
      "Scout for plant bugs and bollworm egg masses on squares",
      "Evaluate square retention — <80% retention warrants action",
      "Apply boron if deficiency symptoms appear",
    ],
  },
  {
    key: "boll_development",
    name: "Boll Development",
    icon: "nutrition-outline",
    gddMin: 800,
    gddMax: 1200,
    description: "Flowers are opening and bolls are setting; lint and seed are accumulating inside each boll.",
    keyTasks: [
      "Terminate irrigation before cut-out to encourage boll opening",
      "Apply defoliant timing based on boll maturity and open bolls",
      "Scout for boll weevil and second-generation bollworm",
    ],
  },
  {
    key: "open_bolls",
    name: "Open Bolls & Harvest",
    icon: "checkmark-circle-outline",
    gddMin: 1200,
    gddMax: 1600,
    description: "Bolls are cracking open and lint is drying — the crop is approaching harvest.",
    keyTasks: [
      "Apply harvest aid (defoliant/boll opener) when 60%+ bolls are open",
      "Monitor weather — rain on open bolls degrades fibre quality",
      "Calibrate picker to minimise fibre damage",
    ],
  },
];

const POTATOES_STAGES: CropStage[] = [
  {
    key: "emergence",
    name: "Emergence",
    icon: "leaf-outline",
    gddMin: 0,
    gddMax: 150,
    description: "Sprouts are emerging from seed pieces and breaking through the soil surface.",
    keyTasks: [
      "Ensure soil temp 50–65°F for vigorous emergence",
      "Scout for wireworm and seedcorn maggot damage",
      "Apply pre-emerge herbicide as shoots emerge",
    ],
  },
  {
    key: "vegetative",
    name: "Vegetative Growth",
    icon: "cellular-outline",
    gddMin: 150,
    gddMax: 400,
    description: "The canopy is expanding rapidly; stolons are elongating below ground.",
    keyTasks: [
      "Hill plants to cover stolons and prevent greening",
      "Scout for Colorado potato beetle egg masses and early instars",
      "Apply foliar fungicide for early blight if risk is high",
    ],
  },
  {
    key: "tuber_initiation",
    name: "Tuber Initiation",
    icon: "ellipse-outline",
    gddMin: 400,
    gddMax: 700,
    description: "Stolon tips are swelling into tubers — the number of tubers per plant is being set.",
    keyTasks: [
      "Maintain consistent soil moisture — stress here reduces tuber count",
      "Apply second fungicide spray for late blight protection",
      "Scout for aphid colonies that can vector PVY",
    ],
  },
  {
    key: "tuber_fill",
    name: "Tuber Fill",
    icon: "nutrition-outline",
    gddMin: 700,
    gddMax: 1100,
    description: "Dry matter is rapidly accumulating in tubers — this is the critical yield-building period.",
    keyTasks: [
      "Irrigate to maintain 60–80% field capacity",
      "Continue fungicide programme for late blight",
      "Top-dress nitrogen if tissue tests indicate deficiency",
    ],
  },
  {
    key: "maturity",
    name: "Vine-Down & Harvest",
    icon: "checkmark-circle-outline",
    gddMin: 1100,
    gddMax: 1400,
    description: "Vines are dying back; skin is setting — the crop is ready for harvest.",
    keyTasks: [
      "Vine-kill 2–3 weeks before harvest to set skin",
      "Test tuber specific gravity for processing quality",
      "Harvest before soil temp drops below 45°F",
    ],
  },
];

const GRAPES_STAGES: CropStage[] = [
  {
    key: "budbreak",
    name: "Budbreak",
    icon: "leaf-outline",
    gddMin: 0,
    gddMax: 100,
    description: "Buds are swelling and woolly tips are visible — the vine is leaving dormancy.",
    keyTasks: [
      "Apply dormant copper spray to suppress botrytis and downy mildew",
      "Complete pruning if not yet done",
      "Monitor for frost as young shoots are very frost-sensitive",
    ],
  },
  {
    key: "shoot_growth",
    name: "Shoot Growth",
    icon: "cellular-outline",
    gddMin: 100,
    gddMax: 400,
    description: "Shoots are elongating rapidly and flower clusters are becoming visible.",
    keyTasks: [
      "Begin fungicide programme for powdery and downy mildew",
      "Shoot position and tuck to open canopy",
      "Monitor for leafroll virus symptoms on young shoots",
    ],
  },
  {
    key: "flowering",
    name: "Flowering & Fruit Set",
    icon: "flower-outline",
    gddMin: 400,
    gddMax: 600,
    description: "Caps are falling and pollination is occurring — berry number per cluster is being determined.",
    keyTasks: [
      "Avoid spraying oils or sulfur during full bloom",
      "Apply gibberellic acid for Thompsons/seedless if berry size is a goal",
      "Scout for botrytis in flower clusters after wet events",
    ],
  },
  {
    key: "veraison",
    name: "Veraison & Ripening",
    icon: "color-palette-outline",
    gddMin: 600,
    gddMax: 900,
    description: "Berries are softening and changing colour; sugar is accumulating and acidity is falling.",
    keyTasks: [
      "Pull leaves around clusters to improve colour and air circulation",
      "Monitor Brix weekly — target harvest at varietal-specific level",
      "Stop fungicide applications according to pre-harvest interval",
    ],
  },
  {
    key: "harvest",
    name: "Harvest",
    icon: "checkmark-circle-outline",
    gddMin: 900,
    gddMax: 1200,
    description: "The crop has reached target Brix and pH — berries are ready to pick.",
    keyTasks: [
      "Sample Brix, pH, and TA daily in the final week",
      "Pick early morning to preserve aromatics in warm weather",
      "Plan cold chain to move fruit to winery quickly",
    ],
  },
];

const ALMONDS_STAGES: CropStage[] = [
  {
    key: "bloom",
    name: "Bloom & Pollination",
    icon: "flower-outline",
    gddMin: 0,
    gddMax: 150,
    description: "Flowers are open and dependent on bee activity for pollination — the most critical period of the season.",
    keyTasks: [
      "Ensure bee hives are in place (2+ hives/acre)",
      "Avoid insecticide applications during bloom",
      "Monitor for late frost that can damage open flowers",
    ],
  },
  {
    key: "jacket_fall",
    name: "Jacket Fall & Shell Hardening",
    icon: "leaf-outline",
    gddMin: 150,
    gddMax: 500,
    description: "Flower parts are falling; the shell is hardening around the developing kernel.",
    keyTasks: [
      "Apply first fungicide spray for shot hole and anthracnose",
      "Begin navel orangeworm spray programme at jacket fall",
      "Irrigate to support rapid hull growth",
    ],
  },
  {
    key: "hull_split",
    name: "Hull Split",
    icon: "cut-outline",
    gddMin: 500,
    gddMax: 900,
    description: "Hulls are splitting open, exposing the shell — the most critical pest management window.",
    keyTasks: [
      "Apply navel orangeworm spray at hull split — timing is critical",
      "Monitor for ants moving into splits",
      "Begin shaker harvest scheduling as split progresses to 100%",
    ],
  },
  {
    key: "harvest",
    name: "Harvest",
    icon: "checkmark-circle-outline",
    gddMin: 900,
    gddMax: 1200,
    description: "Hulls are fully open and dry — the orchard is ready for mechanical shaking and pickup.",
    keyTasks: [
      "Shake and sweep when 95–100% of nuts are split",
      "Allow hulls to dry 7–10 days before pickup to reduce mould",
      "Monitor for rain events that could cause quality loss",
    ],
  },
];

const APPLES_STAGES: CropStage[] = [
  {
    key: "bloom",
    name: "Bloom",
    icon: "flower-outline",
    gddMin: 0,
    gddMax: 150,
    description: "Pink tip to petal fall — pollination window is open and frost sensitivity is extreme.",
    keyTasks: [
      "Ensure adequate polliniser varieties and bee activity",
      "Use frost protection (overhead irrigation, wind machines) on cold nights",
      "Avoid fungicides with oil during bloom to protect bees",
    ],
  },
  {
    key: "vegetative",
    name: "Shoot Growth & Fruit Set",
    icon: "cellular-outline",
    gddMin: 150,
    gddMax: 500,
    description: "Fruitlets are setting and competing; the annual shoot is rapidly elongating.",
    keyTasks: [
      "Apply chemical thinner at 8–12 mm fruit size to improve return bloom",
      "Begin scab fungicide programme with leaf wetting events",
      "Shoot and sucker removal in spur-type varieties",
    ],
  },
  {
    key: "fruit_development",
    name: "Fruit Development",
    icon: "nutrition-outline",
    gddMin: 500,
    gddMax: 900,
    description: "Cells are dividing and expanding in the fruitlet — size and potential quality are being determined.",
    keyTasks: [
      "Hand thin if chemical thin was insufficient",
      "Maintain irrigation at 70–80% field capacity",
      "Monitor for codling moth, fire blight, and bitter pit calcium deficiency",
    ],
  },
  {
    key: "harvest",
    name: "Maturation & Harvest",
    icon: "checkmark-circle-outline",
    gddMin: 900,
    gddMax: 1200,
    description: "Fruit is maturing — starch is converting to sugar and background colour is changing.",
    keyTasks: [
      "Test starch-iodine pattern and pressure to time harvest",
      "Pick early varieties before over-maturity causes watercore",
      "Cool fruit to 32–35°F within 24 h of harvest",
    ],
  },
];

const RICE_STAGES: CropStage[] = [
  {
    key: "germination",
    name: "Germination & Emergence",
    icon: "leaf-outline",
    gddMin: 0,
    gddMax: 100,
    description: "Seeds are germinating and the coleoptile is pushing through the flood water.",
    keyTasks: [
      "Maintain shallow flood (2–4 inches) for uniform emergence",
      "Scout for water weevil in seedling root zone",
      "Apply propanil or herbicide for barnyard grass control",
    ],
  },
  {
    key: "vegetative",
    name: "Vegetative & Tillering",
    icon: "cellular-outline",
    gddMin: 100,
    gddMax: 700,
    description: "Tillers are forming and the plant is building the yield structure — tiller number sets potential panicle number.",
    keyTasks: [
      "Apply split nitrogen — first at 4-leaf, second at panicle initiation",
      "Maintain flood depth at 3–5 inches to suppress weeds",
      "Scout for rice water weevil and stink bugs",
    ],
  },
  {
    key: "reproductive",
    name: "Panicle Initiation & Heading",
    icon: "flower-outline",
    gddMin: 700,
    gddMax: 1000,
    description: "The panicle is forming inside the boot — cool temperatures now reduce grain number.",
    keyTasks: [
      "Apply fungicide for blast if humid weather is forecast",
      "Maintain flood through heading — any drought here cuts yield sharply",
      "Scout for rice stink bug on emerging heads",
    ],
  },
  {
    key: "ripening",
    name: "Ripening",
    icon: "nutrition-outline",
    gddMin: 1000,
    gddMax: 1200,
    description: "Grain is filling from the top of the panicle down; starch is accumulating in each kernel.",
    keyTasks: [
      "Drain field 5–7 days before harvest for trafficability",
      "Scout for panicle-feeding insects and sheath blight",
      "Plan combine settings for the expected moisture",
    ],
  },
  {
    key: "maturity",
    name: "Maturity & Harvest",
    icon: "checkmark-circle-outline",
    gddMin: 1200,
    gddMax: 1500,
    description: "85–95% of kernels have changed from green to golden-brown straw colour.",
    keyTasks: [
      "Harvest at 18–24% moisture for milling quality",
      "Avoid delays — over-ripe rice shatters and downgrades",
      "Arrange immediate drying to ≤14% storage moisture",
    ],
  },
];

const OTHER_STAGES: CropStage[] = [
  {
    key: "germination",
    name: "Germination",
    icon: "leaf-outline",
    gddMin: 0,
    gddMax: 150,
    description: "Seeds are germinating and seedlings are emerging above the soil surface.",
    keyTasks: [
      "Verify uniform stand establishment",
      "Scout for seedling diseases and soil insects",
      "Apply pre-emergence weed control if needed",
    ],
  },
  {
    key: "vegetative",
    name: "Vegetative Growth",
    icon: "cellular-outline",
    gddMin: 150,
    gddMax: 500,
    description: "The plant is establishing its canopy and root system before reproductive development.",
    keyTasks: [
      "Control weeds early to avoid yield loss",
      "Monitor for insect and disease pressure",
      "Ensure adequate nutrition with soil or tissue tests",
    ],
  },
  {
    key: "reproductive",
    name: "Reproductive",
    icon: "flower-outline",
    gddMin: 500,
    gddMax: 900,
    description: "The plant is flowering or forming reproductive structures — yield components are being set.",
    keyTasks: [
      "Maintain adequate moisture through flowering",
      "Protect yield with fungicide if disease risk is elevated",
      "Avoid stress events that reduce fruit or seed set",
    ],
  },
  {
    key: "maturity",
    name: "Maturity",
    icon: "checkmark-circle-outline",
    gddMin: 900,
    gddMax: 1200,
    description: "The crop has completed grain or fruit fill and is ready for harvest.",
    keyTasks: [
      "Test crop maturity before committing to harvest date",
      "Plan harvest logistics and storage capacity",
      "Monitor weather windows for field operations",
    ],
  },
];

// ── Stage lookup table ────────────────────────────────────────────────────────

const STAGE_MAP: Record<string, CropStage[]> = {
  corn:         CORN_STAGES,
  soybeans:     SOYBEANS_STAGES,
  winter_wheat: WINTER_WHEAT_STAGES,
  cotton:       COTTON_STAGES,
  potatoes:     POTATOES_STAGES,
  grapes:       GRAPES_STAGES,
  almonds:      ALMONDS_STAGES,
  apples:       APPLES_STAGES,
  rice:         RICE_STAGES,
  other:        OTHER_STAGES,
};

// ── Public API ────────────────────────────────────────────────────────────────

export interface CurrentStageResult {
  stages: CropStage[];
  currentIndex: number;
  current: CropStage;
  /** 0–1 fraction through the current stage */
  stageProgress: number;
  /** Estimated GDD remaining until the next stage (null at final stage) */
  gddToNextStage: number | null;
}

/**
 * Given a crop type and accumulated GDD, returns the current growth stage and
 * progress information.
 */
export function getCurrentStage(
  cropType: string,
  accumulatedGDD: number
): CurrentStageResult {
  const stages = STAGE_MAP[cropType] ?? OTHER_STAGES;

  // Find the last stage the crop has reached
  let currentIndex = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    if (accumulatedGDD >= stages[i].gddMin) {
      currentIndex = i;
      break;
    }
  }

  const current = stages[currentIndex];
  const isLast = currentIndex === stages.length - 1;

  const stageGDDRange = current.gddMax - current.gddMin;
  const gddIntoStage = Math.max(0, accumulatedGDD - current.gddMin);
  const stageProgress = stageGDDRange > 0
    ? Math.min(1, gddIntoStage / stageGDDRange)
    : 1;

  const gddToNextStage = isLast
    ? null
    : Math.max(0, current.gddMax - accumulatedGDD);

  return { stages, currentIndex, current, stageProgress, gddToNextStage };
}

/**
 * Returns the list of stages for a given crop type (for rendering an empty
 * stage pipeline when no GDD data is available yet).
 */
export function getStagesForCrop(cropType: string): CropStage[] {
  return STAGE_MAP[cropType] ?? OTHER_STAGES;
}
