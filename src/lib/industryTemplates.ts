export type Industry =
  | "restaurant"
  | "cafe"
  | "hotel"
  | "retail"
  | "healthcare"
  | "gym"
  | "manufacturing"
  | "cleaning"
  | "other";

export const INDUSTRY_OPTIONS: { value: Industry; label: string }[] = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café / Coffee Shop" },
  { value: "hotel", label: "Hotel" },
  { value: "retail", label: "Retail" },
  { value: "healthcare", label: "Healthcare / Clinic" },
  { value: "gym", label: "Gym / Fitness" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "cleaning", label: "Cleaning Services" },
  { value: "other", label: "Other" },
];

export interface IndustryDefaults {
  department: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  shiftDays: number[]; // 0=Sun, 1=Mon...6=Sat
}

export const INDUSTRY_DEFAULTS: Partial<Record<Industry, IndustryDefaults>> = {
  restaurant: {
    department: "Main Kitchen",
    shiftName: "Morning Shift",
    shiftStart: "08:00",
    shiftEnd: "16:00",
    shiftDays: [1, 2, 3, 4, 5],
  },
  cafe: {
    department: "Front of House",
    shiftName: "Opening Shift",
    shiftStart: "06:00",
    shiftEnd: "14:00",
    shiftDays: [1, 2, 3, 4, 5],
  },
  hotel: {
    department: "Housekeeping",
    shiftName: "Day Shift",
    shiftStart: "09:00",
    shiftEnd: "17:00",
    shiftDays: [0, 1, 2, 3, 4, 5, 6],
  },
};

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  estMinutes: number;
  frequency: "daily" | "weekly";
  criticality: number;
}

export const INDUSTRY_TASKS: Partial<Record<Industry, TaskTemplate[]>> = {
  restaurant: [
    { id: "r1", title: "Open kitchen checklist", description: "Equipment check, prep stations ready, sanitize surfaces", estMinutes: 20, frequency: "daily", criticality: 5 },
    { id: "r2", title: "Walk-in fridge temperature check", description: "Log temperatures for all refrigeration units", estMinutes: 10, frequency: "daily", criticality: 5 },
    { id: "r3", title: "Prep station sanitization", description: "Clean and sanitize all food prep surfaces", estMinutes: 15, frequency: "daily", criticality: 4 },
    { id: "r4", title: "Restock dry goods", description: "Check and restock dry storage items", estMinutes: 20, frequency: "daily", criticality: 3 },
    { id: "r5", title: "Floor and drain cleaning", description: "Deep clean kitchen floors and drains", estMinutes: 30, frequency: "daily", criticality: 4 },
    { id: "r6", title: "Hood and vent inspection", description: "Inspect exhaust hoods and ventilation", estMinutes: 15, frequency: "weekly", criticality: 3 },
    { id: "r7", title: "Waste and recycling rotation", description: "Empty bins, replace liners, move to dumpster", estMinutes: 15, frequency: "daily", criticality: 3 },
    { id: "r8", title: "Close kitchen checklist", description: "Equipment off, surfaces cleaned, waste removed", estMinutes: 25, frequency: "daily", criticality: 5 },
  ],
  cafe: [
    { id: "c1", title: "Espresso machine calibration", description: "Pull test shots, adjust grind and dose", estMinutes: 10, frequency: "daily", criticality: 5 },
    { id: "c2", title: "Display case refresh", description: "Rotate pastries, check dates, restock", estMinutes: 15, frequency: "daily", criticality: 4 },
    { id: "c3", title: "Milk and syrup restock", description: "Check fridges and syrup bottles, restock", estMinutes: 10, frequency: "daily", criticality: 3 },
    { id: "c4", title: "Wipe down tables and seating", description: "Clean all customer-facing surfaces", estMinutes: 15, frequency: "daily", criticality: 4 },
    { id: "c5", title: "Restroom check", description: "Clean restrooms, restock supplies", estMinutes: 10, frequency: "daily", criticality: 4 },
    { id: "c6", title: "Grinder cleaning", description: "Deep clean coffee grinders", estMinutes: 20, frequency: "weekly", criticality: 3 },
    { id: "c7", title: "Cash register reconciliation", description: "Count drawer, reconcile with POS", estMinutes: 10, frequency: "daily", criticality: 5 },
    { id: "c8", title: "Close store checklist", description: "Equipment off, surfaces clean, doors locked", estMinutes: 20, frequency: "daily", criticality: 5 },
  ],
  hotel: [
    { id: "h1", title: "Room turnover inspection", description: "Inspect cleaned rooms before guest check-in", estMinutes: 15, frequency: "daily", criticality: 5 },
    { id: "h2", title: "Lobby and common area cleaning", description: "Vacuum, dust, and sanitize public areas", estMinutes: 30, frequency: "daily", criticality: 4 },
    { id: "h3", title: "Linen inventory check", description: "Count and restock linen closets per floor", estMinutes: 20, frequency: "daily", criticality: 3 },
    { id: "h4", title: "Minibar restock", description: "Check and restock minibars in occupied rooms", estMinutes: 20, frequency: "daily", criticality: 3 },
    { id: "h5", title: "Pool area maintenance", description: "Check water chemistry, clean deck area", estMinutes: 20, frequency: "daily", criticality: 4 },
    { id: "h6", title: "Fire exit inspection", description: "Verify all fire exits clear and signage visible", estMinutes: 15, frequency: "weekly", criticality: 5 },
    { id: "h7", title: "Elevator and hallway check", description: "Inspect elevators, clean hallway carpets", estMinutes: 15, frequency: "daily", criticality: 3 },
    { id: "h8", title: "Guest amenity restock", description: "Restock toiletries and amenities cart", estMinutes: 15, frequency: "daily", criticality: 4 },
  ],
  retail: [
    { id: "rt1", title: "Open store checklist", description: "Lights, POS, signage, entrance ready", estMinutes: 15, frequency: "daily", criticality: 5 },
    { id: "rt2", title: "Shelf restocking", description: "Check low-stock items, restock from back", estMinutes: 30, frequency: "daily", criticality: 4 },
    { id: "rt3", title: "Price tag audit", description: "Verify prices match system, fix discrepancies", estMinutes: 20, frequency: "weekly", criticality: 3 },
    { id: "rt4", title: "Fitting room reset", description: "Return items, clean mirrors, tidy space", estMinutes: 15, frequency: "daily", criticality: 3 },
    { id: "rt5", title: "Floor sweep and tidy", description: "Sweep floors, straighten displays", estMinutes: 20, frequency: "daily", criticality: 3 },
    { id: "rt6", title: "Close store checklist", description: "Cash reconciliation, lights off, alarm set", estMinutes: 20, frequency: "daily", criticality: 5 },
  ],
  healthcare: [
    { id: "hc1", title: "Waiting room sanitization", description: "Disinfect chairs, tables, and high-touch surfaces", estMinutes: 20, frequency: "daily", criticality: 5 },
    { id: "hc2", title: "Medical supply check", description: "Verify stock levels for gloves, masks, essentials", estMinutes: 15, frequency: "daily", criticality: 5 },
    { id: "hc3", title: "Equipment sterilization", description: "Sterilize reusable medical instruments", estMinutes: 25, frequency: "daily", criticality: 5 },
    { id: "hc4", title: "Biohazard waste disposal", description: "Properly dispose of biohazard containers", estMinutes: 15, frequency: "daily", criticality: 5 },
    { id: "hc5", title: "Patient room turnover", description: "Clean and prep exam rooms between patients", estMinutes: 15, frequency: "daily", criticality: 4 },
    { id: "hc6", title: "Fire extinguisher check", description: "Inspect all fire extinguishers and safety equipment", estMinutes: 15, frequency: "weekly", criticality: 4 },
  ],
  gym: [
    { id: "g1", title: "Equipment wipe-down", description: "Sanitize all machines and free weights", estMinutes: 30, frequency: "daily", criticality: 5 },
    { id: "g2", title: "Locker room cleaning", description: "Clean showers, restock towels, sanitize lockers", estMinutes: 25, frequency: "daily", criticality: 4 },
    { id: "g3", title: "Equipment safety check", description: "Inspect cables, pins, and moving parts", estMinutes: 20, frequency: "weekly", criticality: 5 },
    { id: "g4", title: "Pool chemistry test", description: "Test and adjust pool/spa chemical levels", estMinutes: 15, frequency: "daily", criticality: 5 },
    { id: "g5", title: "Towel and amenity restock", description: "Restock towel stations and water coolers", estMinutes: 15, frequency: "daily", criticality: 3 },
    { id: "g6", title: "Floor and mat cleaning", description: "Mop floors, disinfect yoga and stretching mats", estMinutes: 20, frequency: "daily", criticality: 4 },
  ],
  manufacturing: [
    { id: "m1", title: "Machine startup checklist", description: "Safety checks, warm-up procedures, calibration", estMinutes: 20, frequency: "daily", criticality: 5 },
    { id: "m2", title: "Safety equipment inspection", description: "Check PPE stations, eye wash, fire extinguishers", estMinutes: 15, frequency: "daily", criticality: 5 },
    { id: "m3", title: "Raw material inventory", description: "Count and log incoming materials", estMinutes: 20, frequency: "daily", criticality: 4 },
    { id: "m4", title: "Quality control sample", description: "Pull and inspect product samples from line", estMinutes: 15, frequency: "daily", criticality: 5 },
    { id: "m5", title: "Waste and scrap logging", description: "Weigh and record production waste", estMinutes: 10, frequency: "daily", criticality: 3 },
    { id: "m6", title: "Machine shutdown checklist", description: "Power down, lock out, clean work area", estMinutes: 20, frequency: "daily", criticality: 5 },
  ],
  cleaning: [
    { id: "cl1", title: "Supply cart preparation", description: "Stock cart with chemicals, tools, and liners", estMinutes: 15, frequency: "daily", criticality: 4 },
    { id: "cl2", title: "Restroom deep clean", description: "Toilets, sinks, mirrors, floors, restock", estMinutes: 25, frequency: "daily", criticality: 5 },
    { id: "cl3", title: "Trash collection and replacement", description: "Empty all bins, replace liners", estMinutes: 20, frequency: "daily", criticality: 4 },
    { id: "cl4", title: "Floor mopping and vacuuming", description: "Vacuum carpets, mop hard floors", estMinutes: 30, frequency: "daily", criticality: 4 },
    { id: "cl5", title: "Window and glass cleaning", description: "Clean interior glass surfaces and windows", estMinutes: 20, frequency: "weekly", criticality: 3 },
    { id: "cl6", title: "Chemical inventory check", description: "Log chemical levels, note reorder needs", estMinutes: 10, frequency: "weekly", criticality: 3 },
  ],
};

export const TIMEZONE_OPTIONS = [
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "America/Anchorage", label: "Alaska (AKST)" },
  { value: "America/Los_Angeles", label: "Pacific (PST)" },
  { value: "America/Denver", label: "Mountain (MST)" },
  { value: "America/Chicago", label: "Central (CST)" },
  { value: "America/New_York", label: "Eastern (EST)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (ART)" },
  { value: "Atlantic/Reykjavik", label: "Iceland (GMT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Europe/Madrid", label: "Madrid (CET)" },
  { value: "Europe/Rome", label: "Rome (CET)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
  { value: "Europe/Zurich", label: "Zurich (CET)" },
  { value: "Europe/Stockholm", label: "Stockholm (CET)" },
  { value: "Europe/Helsinki", label: "Helsinki (EET)" },
  { value: "Europe/Athens", label: "Athens (EET)" },
  { value: "Europe/Istanbul", label: "Istanbul (TRT)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Karachi", label: "Karachi (PKT)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Dhaka", label: "Dhaka (BST)" },
  { value: "Asia/Bangkok", label: "Bangkok (ICT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Shanghai", label: "China (CST)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
  { value: "Pacific/Auckland", label: "New Zealand (NZST)" },
];
