// SYNTHETIC DATA ONLY. Every person, owner, policy and event below is fictitious and was
// written for this prototype. None of it is Emirates Group data or Emirates policy.
// When the organizer's synthetic pack (employees.csv, journey_events.csv, service_requests.csv,
// pulse_feedback.csv, policies/, journey_maps.md) is available, replace this module with a loader.

export const DEMO_TODAY_DEFAULT = "2026-10-18";

// Named human owners (synthetic). Every intervention routes to one of these people.
export const OWNERS = {
  "OWN-IT": { id: "OWN-IT", name: "Omar Haddad", role: { en: "IT Onboarding Lead", ar: "مسؤول تهيئة تقنية المعلومات" }, team: "IT" },
  "OWN-VISA": { id: "OWN-VISA", name: "Huda Rahman", role: { en: "Visa & Immigration Officer", ar: "مسؤولة التأشيرات والهجرة" }, team: "VISA" },
  "OWN-FAC": { id: "OWN-FAC", name: "Grace Mensah", role: { en: "Facilities Coordinator", ar: "منسقة المرافق" }, team: "FACILITIES" },
  "OWN-LRN": { id: "OWN-LRN", name: "Leila Farouk", role: { en: "Learning Coordinator", ar: "منسقة التعلّم" }, team: "LEARNING" },
  "OWN-HRBP": { id: "OWN-HRBP", name: "Sara Al Ameri", role: { en: "HR Business Partner", ar: "شريكة أعمال الموارد البشرية" }, team: "HRBP" },
  "OWN-HRS": { id: "OWN-HRS", name: "Priya Nair", role: { en: "HR Services Advisor", ar: "مستشارة خدمات الموارد البشرية" }, team: "HR" },
  "OWN-MOB": { id: "OWN-MOB", name: "Daniel Costa", role: { en: "Mobility & Relocation Advisor", ar: "مستشار التنقل والانتقال" }, team: "MOBILITY" },
  "OWN-MGR": { id: "OWN-MGR", name: "Line manager", role: { en: "Your line manager", ar: "مديرك المباشر" }, team: "MANAGER" },
};

// Journey maps: expected steps, owners and target day (relative to journey start = day 1).
export const JOURNEY_MAPS = {
  onboarding: {
    id: "onboarding",
    name: { en: "Onboarding", ar: "التهيئة الوظيفية" },
    steps: [
      { id: "ONB-01", name: { en: "Offer accepted", ar: "قبول العرض" }, owner: "OWN-HRS", targetDay: -30, policy: "POL-ONB-001" },
      { id: "ONB-02", name: { en: "Entry permit issued", ar: "إصدار تصريح الدخول" }, owner: "OWN-VISA", targetDay: -10, policy: "POL-VIS-001", requiresVisa: true },
      { id: "ONB-03", name: { en: "Access card and workspace ready", ar: "تجهيز بطاقة الدخول ومكان العمل" }, owner: "OWN-FAC", targetDay: 1, policy: "POL-FAC-001" },
      { id: "ONB-04", name: { en: "IT kit issued (laptop, phone)", ar: "تسليم الأجهزة (حاسوب، هاتف)" }, owner: "OWN-IT", targetDay: 2, policy: "POL-ONB-002", requestType: "IT_EQUIPMENT" },
      { id: "ONB-05", name: { en: "System access granted", ar: "منح صلاحيات الأنظمة" }, owner: "OWN-IT", targetDay: 3, policy: "POL-ONB-002", requestType: "IT_ACCESS" },
      { id: "ONB-06", name: { en: "Medical fitness test", ar: "فحص اللياقة الطبية" }, owner: "OWN-VISA", targetDay: 4, policy: "POL-VIS-001", requiresVisa: true },
      { id: "ONB-07", name: { en: "Mandatory induction booked", ar: "حجز التدريب التعريفي الإلزامي" }, owner: "OWN-LRN", targetDay: 5, policy: "POL-LRN-001", requestType: "LEARNING_BOOKING" },
      { id: "ONB-08", name: { en: "Emirates ID biometrics", ar: "البصمات لبطاقة الهوية الإماراتية" }, owner: "OWN-VISA", targetDay: 6, policy: "POL-VIS-001", requiresVisa: true },
      { id: "ONB-09", name: { en: "Residence visa stamped", ar: "ختم تأشيرة الإقامة" }, owner: "OWN-VISA", targetDay: 10, policy: "POL-VIS-001", requiresVisa: true },
      { id: "ONB-10", name: { en: "Bank account and salary set-up", ar: "فتح الحساب المصرفي وإعداد الراتب" }, owner: "OWN-HRS", targetDay: 14, policy: "POL-PAY-001", dependsOn: "ONB-09" },
      { id: "ONB-11", name: { en: "30-day check-in", ar: "لقاء المتابعة بعد 30 يومًا" }, owner: "OWN-HRBP", targetDay: 30, policy: "POL-ONB-001" },
    ],
  },
  mobility: {
    id: "mobility",
    name: { en: "Internal mobility", ar: "التنقل الداخلي" },
    steps: [
      { id: "MOB-01", name: { en: "Transfer approved", ar: "اعتماد النقل" }, owner: "OWN-HRBP", targetDay: 1, policy: "POL-MOB-001" },
      { id: "MOB-02", name: { en: "Handover plan agreed", ar: "الاتفاق على خطة التسليم" }, owner: "OWN-MGR", targetDay: 7, policy: "POL-MOB-003" },
      { id: "MOB-03", name: { en: "Relocation allowance approved", ar: "اعتماد بدل الانتقال" }, owner: "OWN-MOB", targetDay: 10, policy: "POL-MOB-002", locationMoveOnly: true, requestType: "RELOCATION" },
      { id: "MOB-04", name: { en: "Role system access updated", ar: "تحديث صلاحيات الأنظمة للدور الجديد" }, owner: "OWN-IT", targetDay: 14, policy: "POL-ONB-002", requestType: "IT_ACCESS" },
      { id: "MOB-05", name: { en: "Start in new team", ar: "البدء في الفريق الجديد" }, owner: "OWN-MGR", targetDay: 21, policy: "POL-MOB-001" },
      { id: "MOB-06", name: { en: "Housing and shipment arranged", ar: "ترتيب السكن والشحن" }, owner: "OWN-MOB", targetDay: 21, policy: "POL-MOB-002", locationMoveOnly: true, dependsOn: "MOB-03" },
      { id: "MOB-07", name: { en: "Learning plan for new role", ar: "خطة التعلّم للدور الجديد" }, owner: "OWN-LRN", targetDay: 28, policy: "POL-LRN-001", requestType: "LEARNING_BOOKING" },
      { id: "MOB-08", name: { en: "30-day settle-in check", ar: "متابعة الاستقرار بعد 30 يومًا" }, owner: "OWN-HRBP", targetDay: 51, policy: "POL-MOB-001" },
    ],
  },
};

// Routine request catalogue: each is handed off to a (simulated) downstream agent or workflow.
export const REQUEST_TYPES = {
  IT_EQUIPMENT: { id: "IT_EQUIPMENT", queue: "IT Service Desk", owner: "OWN-IT", slaDays: 2, policy: "POL-ONB-002", name: { en: "IT equipment (laptop/phone)", ar: "أجهزة تقنية المعلومات (حاسوب/هاتف)" }, keywords: ["laptop", "computer", "phone", "equipment", "kit", "device", "monitor", "حاسوب", "لابتوب", "جهاز", "هاتف"] },
  IT_ACCESS: { id: "IT_ACCESS", queue: "IT Service Desk", owner: "OWN-IT", slaDays: 3, policy: "POL-ONB-002", name: { en: "System access", ar: "صلاحيات الأنظمة" }, keywords: ["access", "login", "password", "account", "system", "vpn", "email account", "صلاحية", "دخول", "حساب", "كلمة المرور"] },
  LEARNING_BOOKING: { id: "LEARNING_BOOKING", queue: "Learning Services", owner: "OWN-LRN", slaDays: 5, policy: "POL-LRN-001", name: { en: "Book training", ar: "حجز تدريب" }, keywords: ["training", "induction", "course", "learning", "book", "تدريب", "دورة", "تعلم"] },
  ACCESS_CARD: { id: "ACCESS_CARD", queue: "Facilities", owner: "OWN-FAC", slaDays: 1, policy: "POL-FAC-001", name: { en: "Access card / desk", ar: "بطاقة الدخول / المكتب" }, keywords: ["access card", "badge", "desk", "parking", "workspace", "بطاقة", "مكتب", "موقف"] },
  HR_LETTER: { id: "HR_LETTER", queue: "HR Services", owner: "OWN-HRS", slaDays: 3, policy: "POL-PAY-001", name: { en: "HR letter (salary certificate)", ar: "خطاب من الموارد البشرية (شهادة راتب)" }, keywords: ["letter", "certificate", "salary certificate", "noc", "خطاب", "شهادة"] },
  VISA_SUPPORT: { id: "VISA_SUPPORT", queue: "Visa & Immigration", owner: "OWN-VISA", slaDays: 2, policy: "POL-VIS-001", name: { en: "Visa case follow-up", ar: "متابعة ملف التأشيرة" }, keywords: ["visa", "residence", "emirates id", "medical", "permit", "تأشيرة", "إقامة", "هوية", "فحص طبي"] },
  RELOCATION: { id: "RELOCATION", queue: "Mobility & Relocation", owner: "OWN-MOB", slaDays: 10, policy: "POL-MOB-002", name: { en: "Relocation support", ar: "دعم الانتقال" }, keywords: ["relocation", "housing", "shipment", "move", "flat", "انتقال", "سكن", "شحن"] },
};

// Featured synthetic personas used in the judge path. Population for the aggregate view is generated.
export const PERSONAS = [
  {
    id: "E-1042", name: "Aisha Karim", journey: "onboarding", startDate: "2026-10-14",
    role: "Revenue Analyst", team: "Commercial Analytics", location: "Dubai", manager: "Khalid Mansour",
    needsVisa: false, locationMove: false,
    scenario: { en: "Day 5 of onboarding, laptop not yet issued", ar: "اليوم الخامس من التهيئة، لم يُسلَّم الحاسوب بعد" },
    events: [
      { step: "ONB-01", date: "2026-09-10" },
      { step: "ONB-03", date: "2026-10-14" },
    ],
    requests: [
      { id: "SR-55120", type: "IT_EQUIPMENT", opened: "2026-10-14", status: "open", note: "Standard analyst laptop requested by HR at offer stage" },
    ],
    pulse: [{ date: "2026-10-16", score: 3, comment: "Borrowing a colleague's laptop to read induction material." }],
  },
  {
    id: "E-1077", name: "Daniel Mwangi", journey: "onboarding", startDate: "2026-10-01",
    role: "Aircraft Maintenance Planner", team: "Engineering Planning", location: "Dubai", manager: "Ravi Menon",
    needsVisa: true, locationMove: false,
    scenario: { en: "Residence visa stalled, salary set-up blocked", ar: "تأخر ختم تأشيرة الإقامة، وتعطّل إعداد الراتب" },
    events: [
      { step: "ONB-01", date: "2026-08-28" },
      { step: "ONB-02", date: "2026-09-18" },
      { step: "ONB-03", date: "2026-10-01" },
      { step: "ONB-04", date: "2026-10-02" },
      { step: "ONB-05", date: "2026-10-03" },
      { step: "ONB-06", date: "2026-10-04" },
      { step: "ONB-07", date: "2026-10-05" },
      { step: "ONB-08", date: "2026-10-06" },
    ],
    requests: [
      { id: "SR-54871", type: "VISA_SUPPORT", opened: "2026-10-06", status: "waiting", note: "Residence visa stamping: status 'awaiting documents' since biometrics" },
    ],
    pulse: [
      { date: "2026-10-08", score: 3, comment: "Settling in well with the team." },
      { date: "2026-10-15", score: 2, comment: "I can't open a bank account until my visa is stamped and nobody has told me what is missing." },
    ],
  },
  {
    id: "E-0815", name: "Fatima Al Suwaidi", journey: "mobility", startDate: "2026-10-06",
    role: "Customer Experience Lead → Digital Product Owner", team: "Digital Products", location: "Dubai", manager: "Noura Al Falasi",
    needsVisa: false, locationMove: false,
    scenario: { en: "Internal role move, on track", ar: "انتقال إلى دور داخلي جديد، ضمن الخطة" },
    events: [
      { step: "MOB-01", date: "2026-10-06" },
      { step: "MOB-02", date: "2026-10-10" },
    ],
    requests: [],
    pulse: [],
  },
  {
    id: "E-0931", name: "Arjun Rao", journey: "mobility", startDate: "2026-09-22",
    role: "Station Operations Officer", team: "Airport Services", location: "Dubai → Manchester", manager: "Helen Brooks",
    needsVisa: false, locationMove: true,
    scenario: { en: "Relocation allowance pending, move date close", ar: "بدل الانتقال معلّق وموعد الانتقال قريب" },
    events: [
      { step: "MOB-01", date: "2026-09-22" },
      { step: "MOB-02", date: "2026-09-29" },
      { step: "MOB-04", date: "2026-10-03" },
    ],
    requests: [
      { id: "SR-54402", type: "RELOCATION", opened: "2026-09-24", status: "pending_approval", note: "Relocation allowance claim submitted with shipping quotes" },
    ],
    pulse: [{ date: "2026-10-12", score: 2, comment: "Flight is booked but I still don't know if the allowance covers shipping." }],
  },
  {
    id: "E-1103", name: "Mei Lin Tan", journey: "onboarding", startDate: "2026-10-17",
    role: "Cabin Crew Trainer", team: "Training College", location: "Dubai", manager: "Yousef Saleh",
    needsVisa: true, locationMove: false,
    scenario: { en: "Day 2 of onboarding, everything on track", ar: "اليوم الثاني من التهيئة، كل شيء ضمن الخطة" },
    events: [
      { step: "ONB-01", date: "2026-09-01" },
      { step: "ONB-02", date: "2026-10-02" },
      { step: "ONB-03", date: "2026-10-17" },
      { step: "ONB-04", date: "2026-10-17" },
    ],
    requests: [],
    pulse: [],
  },
];
