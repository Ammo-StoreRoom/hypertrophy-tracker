// ============================================
// PROGRAM DATA — Edit this file to update exercises
// ============================================
const RAMPUP = {
  "Week 1": {
    "Mon: Full Body A": [
      { name: "Barbell Back Squat", sets: 2, reps: "10-12", rest: 120 },
      { name: "Barbell Bench Press", sets: 2, reps: "10-12", rest: 120 },
      { name: "Lat Pulldown (wide)", sets: 2, reps: "10-12", rest: 90 },
      { name: "Overhead Press (BB)", sets: 2, reps: "10-12", rest: 120 },
      { name: "Cable Face Pull", sets: 2, reps: "15", rest: 60 },
      { name: "Standing Calf Raise", sets: 2, reps: "15", rest: 60 },
    ],
    "Wed: Full Body B": [
      { name: "Romanian Deadlift", sets: 2, reps: "10-12", rest: 120 },
      { name: "Incline DB Press", sets: 2, reps: "10-12", rest: 90 },
      { name: "Cable Row (V-bar)", sets: 2, reps: "10-12", rest: 90 },
      { name: "DB Lateral Raise", sets: 2, reps: "12-15", rest: 60 },
      { name: "Barbell Curl", sets: 2, reps: "10-12", rest: 60 },
      { name: "Walking Lunges (BW)", sets: 2, reps: "10/leg", rest: 60 },
    ],
    "Fri: Full Body C": [
      { name: "Goblet Squat (DB)", sets: 2, reps: "12-15", rest: 90 },
      { name: "DB Bench Press", sets: 2, reps: "10-12", rest: 90 },
      { name: "Pull-Ups / Chin-Ups", sets: 2, reps: "AMRAP-2", rest: 120 },
      { name: "Cable Flye (low-high)", sets: 2, reps: "12-15", rest: 60 },
      { name: "Cable Pushdown (rope)", sets: 2, reps: "12-15", rest: 60 },
      { name: "Seated Calf Raise", sets: 2, reps: "15-20", rest: 45 },
    ],
  },
  "Week 2": {
    "Mon: Push": [
      { name: "Barbell Bench Press", sets: 3, reps: "6-8", rest: 150 },
      { name: "Incline DB Press", sets: 3, reps: "8-10", rest: 90 },
      { name: "Cable Flye (low-high)", sets: 3, reps: "12-15", rest: 60 },
      { name: "Overhead Press (BB)", sets: 3, reps: "6-8", rest: 120 },
      { name: "DB Lateral Raise", sets: 3, reps: "12-15", rest: 60 },
      { name: "Weighted Dips", sets: 3, reps: "8-10", rest: 90 },
      { name: "Cable Pushdown (rope)", sets: 3, reps: "10-12", rest: 60 },
    ],
    "Tue: Pull": [
      { name: "Weighted Pull-Ups", sets: 3, reps: "5-8", rest: 150 },
      { name: "Barbell Row (overhand)", sets: 3, reps: "6-8", rest: 120 },
      { name: "Lat Pulldown (wide)", sets: 3, reps: "8-10", rest: 90 },
      { name: "DB Row (single arm)", sets: 3, reps: "8-10/side", rest: 60 },
      { name: "Cable Face Pull", sets: 3, reps: "15-20", rest: 60 },
      { name: "Barbell Curl", sets: 3, reps: "8-10", rest: 60 },
      { name: "Cable Hammer Curl", sets: 3, reps: "10-12", rest: 60 },
    ],
    "Wed: Legs": [
      { name: "Barbell Back Squat", sets: 3, reps: "6-8", rest: 180 },
      { name: "Romanian Deadlift", sets: 3, reps: "8-10", rest: 120 },
      { name: "Bulgarian Split Squat", sets: 3, reps: "10-12/leg", rest: 90 },
      { name: "Cable Pull-Through", sets: 3, reps: "12-15", rest: 60 },
      { name: "Standing Calf Raise", sets: 3, reps: "12-15", rest: 60 },
      { name: "Seated Calf Raise", sets: 3, reps: "15-20", rest: 45 },
    ],
    "Thu: Upper": [
      { name: "Incline BB Bench", sets: 3, reps: "8-10", rest: 90 },
      { name: "Landmine Row", sets: 3, reps: "10-12/side", rest: 90 },
      { name: "Cable Crossover", sets: 3, reps: "12-15", rest: 60 },
      { name: "Cable Straight-Arm Pull", sets: 3, reps: "12-15", rest: 60 },
      { name: "Arnold Press (DB)", sets: 3, reps: "10-12", rest: 90 },
      { name: "Cable Lateral Raise", sets: 3, reps: "12-15", rest: 60 },
      { name: "Cable OH Tricep Ext", sets: 3, reps: "10-12", rest: 60 },
      { name: "Incline DB Curl", sets: 3, reps: "10-12", rest: 60 },
    ],
    "Fri: Lower": [
      { name: "Front Squat (BB)", sets: 3, reps: "8-10", rest: 120 },
      { name: "Stiff-Leg DL (DB)", sets: 3, reps: "10-12", rest: 90 },
      { name: "Step-Ups (DB)", sets: 3, reps: "12/leg", rest: 60 },
      { name: "BB Hip Thrust", sets: 3, reps: "10-12", rest: 90 },
      { name: "Single-Leg Calf Raise", sets: 3, reps: "15-20/leg", rest: 45 },
    ],
  },
};

const PPL = [
  { key: "push-a", label: "Push A", day: "Day 1", exercises: [
    { name: "Barbell Bench Press", sets: 4, reps: "6-8", rest: 150 },
    { name: "Incline DB Press", sets: 4, reps: "8-10", rest: 90 },
    { name: "Cable Flye (low-high)", sets: 3, reps: "12-15", rest: 60 },
    { name: "Overhead Press (BB)", sets: 4, reps: "6-8", rest: 120 },
    { name: "DB Lateral Raise", sets: 3, reps: "12-15", rest: 60 },
    { name: "Weighted Dips", sets: 3, reps: "8-10", rest: 90 },
    { name: "Cable Pushdown (rope)", sets: 3, reps: "10-12", rest: 60 },
  ]},
  { key: "pull-a", label: "Pull A", day: "Day 2", exercises: [
    { name: "Weighted Pull-Ups", sets: 4, reps: "5-8", rest: 150 },
    { name: "Barbell Row (heavy)", sets: 4, reps: "5-7", rest: 150 },
    { name: "Lat Pulldown (wide)", sets: 4, reps: "8-10", rest: 90 },
    { name: "DB Row (single arm)", sets: 3, reps: "8-10/side", rest: 60 },
    { name: "Cable Face Pull", sets: 3, reps: "15-20", rest: 60 },
    { name: "Barbell Curl", sets: 3, reps: "8-10", rest: 60 },
    { name: "Cable Hammer Curl", sets: 3, reps: "10-12", rest: 60 },
  ]},
  { key: "legs-a", label: "Legs A", day: "Day 3", exercises: [
    { name: "Barbell Back Squat", sets: 4, reps: "6-8", rest: 180 },
    { name: "Romanian Deadlift", sets: 4, reps: "8-10", rest: 120 },
    { name: "Bulgarian Split Squat", sets: 3, reps: "10-12/leg", rest: 90 },
    { name: "Walking Lunges (DB)", sets: 3, reps: "12/leg", rest: 90 },
    { name: "Cable Pull-Through", sets: 3, reps: "12-15", rest: 60 },
    { name: "Standing Calf Raise", sets: 4, reps: "12-15", rest: 60 },
    { name: "Seated Calf Raise", sets: 3, reps: "15-20", rest: 45 },
  ]},
  { key: "push-b", label: "Push B", day: "Day 4", exercises: [
    { name: "Incline BB Bench", sets: 4, reps: "8-10", rest: 90 },
    { name: "DB Bench Press", sets: 4, reps: "10-12", rest: 90 },
    { name: "Cable Crossover", sets: 3, reps: "12-15", rest: 60 },
    { name: "Landmine Press", sets: 3, reps: "10-12/arm", rest: 60 },
    { name: "Arnold Press (DB)", sets: 3, reps: "10-12", rest: 90 },
    { name: "Cable Lateral Raise", sets: 3, reps: "12-15", rest: 60 },
    { name: "Cable OH Tricep Ext", sets: 3, reps: "10-12", rest: 60 },
    { name: "Dips (BW to failure)", sets: 3, reps: "AMRAP", rest: 60 },
  ]},
  { key: "pull-b", label: "Pull B", day: "Day 5", exercises: [
    { name: "Lat Pulldown (V-bar)", sets: 4, reps: "10-12", rest: 90 },
    { name: "Landmine Row", sets: 4, reps: "10-12/side", rest: 90 },
    { name: "Barbell Row (underhand)", sets: 3, reps: "8-10", rest: 90 },
    { name: "Cable Straight-Arm Pull", sets: 3, reps: "12-15", rest: 60 },
    { name: "Cable Reverse Flye", sets: 3, reps: "12-15", rest: 60 },
    { name: "Cable Curl (bar)", sets: 3, reps: "10-12", rest: 60 },
    { name: "Incline DB Curl", sets: 3, reps: "10-12", rest: 60 },
  ]},
  { key: "legs-b", label: "Legs B", day: "Day 6", exercises: [
    { name: "Front Squat (BB)", sets: 4, reps: "8-10", rest: 120 },
    { name: "Goblet Squat (pause)", sets: 3, reps: "12-15", rest: 90 },
    { name: "Step-Ups (DB)", sets: 3, reps: "12/leg", rest: 60 },
    { name: "Stiff-Leg DL (DB)", sets: 4, reps: "10-12", rest: 90 },
    { name: "Cable Pull-Through", sets: 3, reps: "12-15", rest: 60 },
    { name: "BB Hip Thrust", sets: 3, reps: "10-12", rest: 90 },
    { name: "Single-Leg Calf Raise", sets: 4, reps: "15-20/leg", rest: 45 },
  ]},
];

// ============================================
// GLUTE-FOCUS PPL — Lower body emphasis program
// ============================================
const RAMPUP_GF = {
  "Week 1": {
    "Mon: Full Body A": [
      { name: "Goblet Squat (DB)", sets: 2, reps: "12-15", rest: 90 },
      { name: "BB Hip Thrust", sets: 2, reps: "10-12", rest: 90 },
      { name: "DB Romanian Deadlift", sets: 2, reps: "10-12", rest: 90 },
      { name: "Lat Pulldown (wide)", sets: 2, reps: "10-12", rest: 90 },
      { name: "DB Overhead Press", sets: 2, reps: "10-12", rest: 90 },
      { name: "Cable Kickback", sets: 2, reps: "12-15/side", rest: 60 },
    ],
    "Wed: Full Body B": [
      { name: "Sumo Deadlift", sets: 2, reps: "10-12", rest: 120 },
      { name: "DB Bench Press", sets: 2, reps: "10-12", rest: 90 },
      { name: "Cable Row (V-bar)", sets: 2, reps: "10-12", rest: 90 },
      { name: "Bulgarian Split Squat", sets: 2, reps: "10-12/leg", rest: 90 },
      { name: "Band Hip Abduction", sets: 2, reps: "15-20", rest: 60 },
      { name: "Standing Calf Raise", sets: 2, reps: "15", rest: 60 },
    ],
    "Fri: Full Body C": [
      { name: "Barbell Back Squat", sets: 2, reps: "10-12", rest: 120 },
      { name: "Incline DB Press", sets: 2, reps: "10-12", rest: 90 },
      { name: "Pull-Ups / Chin-Ups", sets: 2, reps: "AMRAP-2", rest: 120 },
      { name: "Cable Pull-Through", sets: 2, reps: "12-15", rest: 60 },
      { name: "Glute Bridge (BB)", sets: 2, reps: "12-15", rest: 60 },
      { name: "DB Lateral Raise", sets: 2, reps: "12-15", rest: 60 },
    ],
  },
  "Week 2": {
    "Mon: Push": [
      { name: "Barbell Bench Press", sets: 3, reps: "8-10", rest: 120 },
      { name: "Incline DB Press", sets: 3, reps: "10-12", rest: 90 },
      { name: "Cable Flye (low-high)", sets: 3, reps: "12-15", rest: 60 },
      { name: "DB Overhead Press", sets: 3, reps: "8-10", rest: 90 },
      { name: "DB Lateral Raise", sets: 3, reps: "12-15", rest: 60 },
      { name: "Cable Pushdown (rope)", sets: 3, reps: "10-12", rest: 60 },
    ],
    "Tue: Pull": [
      { name: "Lat Pulldown (wide)", sets: 3, reps: "8-10", rest: 90 },
      { name: "Cable Row (V-bar)", sets: 3, reps: "10-12", rest: 90 },
      { name: "DB Row (single arm)", sets: 3, reps: "10-12/side", rest: 60 },
      { name: "Cable Face Pull", sets: 3, reps: "15-20", rest: 60 },
      { name: "Barbell Curl", sets: 3, reps: "10-12", rest: 60 },
      { name: "Cable Hammer Curl", sets: 3, reps: "10-12", rest: 60 },
    ],
    "Wed: Legs (Glute)": [
      { name: "BB Hip Thrust", sets: 3, reps: "8-10", rest: 120 },
      { name: "Romanian Deadlift", sets: 3, reps: "8-10", rest: 120 },
      { name: "Bulgarian Split Squat", sets: 3, reps: "10-12/leg", rest: 90 },
      { name: "Cable Kickback", sets: 3, reps: "12-15/side", rest: 60 },
      { name: "Lying Leg Curl", sets: 3, reps: "10-12", rest: 60 },
      { name: "Standing Calf Raise", sets: 3, reps: "15", rest: 60 },
    ],
    "Thu: Upper": [
      { name: "Incline BB Bench", sets: 3, reps: "8-10", rest: 90 },
      { name: "Lat Pulldown (V-bar)", sets: 3, reps: "10-12", rest: 90 },
      { name: "Cable Crossover", sets: 3, reps: "12-15", rest: 60 },
      { name: "Cable Straight-Arm Pull", sets: 3, reps: "12-15", rest: 60 },
      { name: "Arnold Press (DB)", sets: 3, reps: "10-12", rest: 90 },
      { name: "Cable Lateral Raise", sets: 3, reps: "12-15", rest: 60 },
      { name: "Cable OH Tricep Ext", sets: 3, reps: "10-12", rest: 60 },
    ],
    "Fri: Legs (Quad)": [
      { name: "Barbell Back Squat", sets: 3, reps: "8-10", rest: 150 },
      { name: "Leg Press (wide)", sets: 3, reps: "10-12", rest: 90 },
      { name: "Walking Lunges (DB)", sets: 3, reps: "12/leg", rest: 90 },
      { name: "Sumo Deadlift", sets: 3, reps: "8-10", rest: 120 },
      { name: "Hip Adductor", sets: 3, reps: "12-15", rest: 60 },
      { name: "Seated Calf Raise", sets: 3, reps: "15-20", rest: 45 },
    ],
  },
};

const PPL_GF = [
  { key: "push-a", label: "Push A", day: "Day 1", exercises: [
    { name: "Barbell Bench Press", sets: 3, reps: "8-10", rest: 120 },
    { name: "Incline DB Press", sets: 3, reps: "10-12", rest: 90 },
    { name: "Cable Flye (low-high)", sets: 3, reps: "12-15", rest: 60 },
    { name: "DB Overhead Press", sets: 3, reps: "8-10", rest: 90 },
    { name: "DB Lateral Raise", sets: 3, reps: "12-15", rest: 60 },
    { name: "Cable Pushdown (rope)", sets: 3, reps: "10-12", rest: 60 },
    { name: "Cable OH Tricep Ext", sets: 3, reps: "10-12", rest: 60 },
  ]},
  { key: "pull-a", label: "Pull A", day: "Day 2", exercises: [
    { name: "Lat Pulldown (wide)", sets: 4, reps: "8-10", rest: 90 },
    { name: "Cable Row (V-bar)", sets: 4, reps: "10-12", rest: 90 },
    { name: "DB Row (single arm)", sets: 3, reps: "10-12/side", rest: 60 },
    { name: "Cable Face Pull", sets: 3, reps: "15-20", rest: 60 },
    { name: "Barbell Curl", sets: 3, reps: "10-12", rest: 60 },
    { name: "Cable Hammer Curl", sets: 3, reps: "10-12", rest: 60 },
  ]},
  { key: "legs-a", label: "Legs A (Glute)", day: "Day 3", exercises: [
    { name: "BB Hip Thrust", sets: 4, reps: "8-10", rest: 120 },
    { name: "Romanian Deadlift", sets: 4, reps: "8-10", rest: 120 },
    { name: "Bulgarian Split Squat", sets: 3, reps: "10-12/leg", rest: 90 },
    { name: "Cable Kickback", sets: 3, reps: "12-15/side", rest: 60 },
    { name: "Lying Leg Curl", sets: 3, reps: "10-12", rest: 60 },
    { name: "Cable Pull-Through", sets: 3, reps: "12-15", rest: 60 },
    { name: "Standing Calf Raise", sets: 3, reps: "15", rest: 60 },
  ]},
  { key: "push-b", label: "Push B", day: "Day 4", exercises: [
    { name: "Incline BB Bench", sets: 3, reps: "8-10", rest: 90 },
    { name: "DB Bench Press", sets: 3, reps: "10-12", rest: 90 },
    { name: "Cable Crossover", sets: 3, reps: "12-15", rest: 60 },
    { name: "Arnold Press (DB)", sets: 3, reps: "10-12", rest: 90 },
    { name: "Cable Lateral Raise", sets: 3, reps: "12-15", rest: 60 },
    { name: "Dips (BW to failure)", sets: 3, reps: "AMRAP", rest: 60 },
    { name: "Cable Pushdown (rope)", sets: 3, reps: "10-12", rest: 60 },
  ]},
  { key: "pull-b", label: "Pull B", day: "Day 5", exercises: [
    { name: "Weighted Pull-Ups", sets: 3, reps: "6-8", rest: 120 },
    { name: "Barbell Row (underhand)", sets: 3, reps: "8-10", rest: 90 },
    { name: "Lat Pulldown (V-bar)", sets: 3, reps: "10-12", rest: 90 },
    { name: "Cable Reverse Flye", sets: 3, reps: "12-15", rest: 60 },
    { name: "Cable Curl (bar)", sets: 3, reps: "10-12", rest: 60 },
    { name: "Incline DB Curl", sets: 3, reps: "10-12", rest: 60 },
  ]},
  { key: "legs-b", label: "Legs B (Quad)", day: "Day 6", exercises: [
    { name: "Barbell Back Squat", sets: 4, reps: "6-8", rest: 180 },
    { name: "Leg Press (wide)", sets: 4, reps: "10-12", rest: 90 },
    { name: "Walking Lunges (DB)", sets: 3, reps: "12/leg", rest: 90 },
    { name: "Sumo Deadlift", sets: 3, reps: "8-10", rest: 120 },
    { name: "Hip Adductor", sets: 3, reps: "12-15", rest: 60 },
    { name: "Seated Calf Raise", sets: 3, reps: "15-20", rest: 45 },
  ]},
];

const COMPOUNDS_GF = ["BB Hip Thrust","Barbell Back Squat","Romanian Deadlift","Sumo Deadlift","Barbell Bench Press","Barbell Row (underhand)"];

const MESO_RIR = { 1: "3 RIR", 2: "2 RIR", 3: "1 RIR", 4: "DELOAD" };
const COMPOUNDS = ["Barbell Bench Press","Barbell Back Squat","Overhead Press (BB)","Barbell Row (heavy)","Weighted Pull-Ups","Romanian Deadlift","Incline BB Bench","Front Squat (BB)"];

// ============================================
// PROGRAM REGISTRY — Routes by state.program
// ============================================
const PROGRAMS = {
  standard:      { rampup: RAMPUP,    ppl: PPL,    compounds: COMPOUNDS },
  "glute-focus": { rampup: RAMPUP_GF, ppl: PPL_GF, compounds: COMPOUNDS_GF },
};

const MUSCLE_GROUPS = {
  "Chest": ["Barbell Bench Press","Incline DB Press","DB Bench Press","Cable Flye (low-high)","Cable Crossover","Incline BB Bench","Weighted Dips","Dips (BW to failure)","Landmine Press"],
  "Back": ["Weighted Pull-Ups","Pull-Ups / Chin-Ups","Lat Pulldown (wide)","Lat Pulldown (V-bar)","Barbell Row (overhand)","Barbell Row (underhand)","Barbell Row (heavy)","DB Row (single arm)","Cable Row (V-bar)","Landmine Row","Cable Straight-Arm Pull"],
  "Shoulders": ["Overhead Press (BB)","DB Overhead Press","DB Lateral Raise","Cable Lateral Raise","Arnold Press (DB)","Cable Face Pull","Cable Reverse Flye"],
  "Quads": ["Barbell Back Squat","Front Squat (BB)","Goblet Squat (DB)","Goblet Squat (pause)","Bulgarian Split Squat","Walking Lunges (BW)","Walking Lunges (DB)","Step-Ups (DB)","Leg Press (wide)","Hip Adductor"],
  "Hamstrings": ["Romanian Deadlift","DB Romanian Deadlift","Stiff-Leg DL (DB)","Cable Pull-Through","Lying Leg Curl"],
  "Glutes": ["BB Hip Thrust","Glute Bridge (BB)","Cable Kickback","Band Hip Abduction","Sumo Deadlift"],
  "Calves": ["Standing Calf Raise","Seated Calf Raise","Single-Leg Calf Raise"],
  "Biceps": ["Barbell Curl","Cable Hammer Curl","Cable Curl (bar)","Incline DB Curl"],
  "Triceps": ["Cable Pushdown (rope)","Cable OH Tricep Ext"],
};

function getMuscleGroup(exName) {
  for (const [group, exercises] of Object.entries(MUSCLE_GROUPS)) {
    if (exercises.includes(exName)) return group;
  }
  return "Other";
}

function getAlternativeExercises(exName) {
  const group = getMuscleGroup(exName);
  return (MUSCLE_GROUPS[group] || []).filter(n => n !== exName);
}
