// Static NSE sector mapping — covers the Nifty 50, Bank Nifty, and major sectoral index constituents.
// Stocks not listed here fall into "OTHERS".
// Update this map as index compositions change (quarterly rebalancing).

export type Sector =
  | "BANK"
  | "NBFC"
  | "IT"
  | "PHARMA"
  | "AUTO"
  | "FMCG"
  | "ENERGY"
  | "METAL"
  | "REALTY"
  | "INFRA"
  | "TELECOM"
  | "HEALTHCARE"
  | "CHEMICALS"
  | "PSU"
  | "OTHERS";

export const SECTOR_MAP: Record<string, Sector> = {
  // ── Banking ───────────────────────────────────────────────────────────────
  HDFCBANK: "BANK", ICICIBANK: "BANK", SBIN: "BANK", KOTAKBANK: "BANK",
  AXISBANK: "BANK", INDUSINDBK: "BANK", BANDHANBNK: "BANK", FEDERALBNK: "BANK",
  IDFCFIRSTB: "BANK", PNB: "BANK", BANKBARODA: "BANK", CANARABANK: "BANK",
  UNIONBANK: "BANK", AUBANK: "BANK", RBLBANK: "BANK", CUB: "BANK",
  KARURVYSYA: "BANK", DCBBANK: "BANK", SOUTHBNK: "BANK", JKBANK: "BANK",
  KTKBANK: "BANK", LAKSHVILAS: "BANK", TMB: "BANK", UCOUCBANK: "BANK",
  MAHABANK: "BANK", IOB: "BANK", CENTRALBNK: "BANK",

  // ── NBFC / Fintech ────────────────────────────────────────────────────────
  BAJFINANCE: "NBFC", BAJAJFINSV: "NBFC", CHOLAFIN: "NBFC", "M&MFIN": "NBFC",
  MUTHOOTFIN: "NBFC", MANAPPURAM: "NBFC", SBICARD: "NBFC", POONAWALLA: "NBFC",
  "L&TFH": "NBFC", AAVAS: "NBFC", CREDITACC: "NBFC", APTUS: "NBFC",
  HOMEFIRST: "NBFC", SBFC: "NBFC", UGROCAP: "NBFC", FUSION: "NBFC",
  SPANDANA: "NBFC", ARIHANTCAP: "NBFC",

  // ── IT / Software ─────────────────────────────────────────────────────────
  TCS: "IT", INFY: "IT", WIPRO: "IT", HCLTECH: "IT", TECHM: "IT",
  LTIM: "IT", MPHASIS: "IT", OFSS: "IT", PERSISTENT: "IT", COFORGE: "IT",
  LTTS: "IT", KPITTECH: "IT", HEXAWARE: "IT", BSOFT: "IT", MASTEK: "IT",
  NEWGEN: "IT", RATEGAIN: "IT", TATAELXSI: "IT", CYIENT: "IT",
  NIITLTD: "IT", TANLA: "IT", INTELLECT: "IT",

  // ── Pharma & Life Sciences ────────────────────────────────────────────────
  SUNPHARMA: "PHARMA", DRREDDY: "PHARMA", CIPLA: "PHARMA", DIVISLAB: "PHARMA",
  LUPIN: "PHARMA", BIOCON: "PHARMA", AUROPHARMA: "PHARMA", ALKEM: "PHARMA",
  TORNTPHARM: "PHARMA", ABBOTINDIA: "PHARMA", GLAXO: "PHARMA", IPCA: "PHARMA",
  LAURUSLABS: "PHARMA", GRANULES: "PHARMA", NATCOPHARM: "PHARMA", GLAND: "PHARMA",
  JBCHEPHARM: "PHARMA", ERIS: "PHARMA", AJANTPHARM: "PHARMA", SOLARA: "PHARMA",
  SUVEN: "PHARMA", LAURUS: "PHARMA", STRIDES: "PHARMA",

  // ── Automobiles ───────────────────────────────────────────────────────────
  TATAMOTORS: "AUTO", "M&M": "AUTO", "BAJAJ-AUTO": "AUTO", EICHERMOT: "AUTO",
  HEROMOTOCO: "AUTO", MARUTI: "AUTO", ASHOKLEY: "AUTO", TVSMOTOR: "AUTO",
  MOTHERSON: "AUTO", BOSCHLTD: "AUTO", BALKRISIND: "AUTO", ENDURANCE: "AUTO",
  MINDAIND: "AUTO", SUBROS: "AUTO", SUPRAJIT: "AUTO", SUNDRMFAST: "AUTO",
  EXIDEIND: "AUTO", AMARAJABAT: "AUTO", CEATLTD: "AUTO", MRF: "AUTO",
  APOLLOTYRE: "AUTO", JKTYRE: "AUTO",

  // ── FMCG ──────────────────────────────────────────────────────────────────
  HINDUNILVR: "FMCG", ITC: "FMCG", NESTLEIND: "FMCG", BRITANNIA: "FMCG",
  DABUR: "FMCG", MARICO: "FMCG", GODREJCP: "FMCG", EMAMILTD: "FMCG",
  COLPAL: "FMCG", TATACONSUM: "FMCG", PGHH: "FMCG", RADICO: "FMCG",
  VBL: "FMCG", BIKAJI: "FMCG", DEVYANI: "FMCG", WESTLIFE: "FMCG",
  JYOTHYLAB: "FMCG", BAJAJCON: "FMCG", HATSUN: "FMCG",

  // ── Energy & Oil & Gas ────────────────────────────────────────────────────
  RELIANCE: "ENERGY", ONGC: "ENERGY", BPCL: "ENERGY", IOC: "ENERGY",
  HINDPETRO: "ENERGY", GAIL: "ENERGY", IGL: "ENERGY", MGL: "ENERGY",
  PETRONET: "ENERGY", OIL: "ENERGY", CASTROLIND: "ENERGY", GSPL: "ENERGY",
  GUJGASLTD: "ENERGY", AEGISCHEM: "ENERGY", HPCL: "ENERGY",

  // ── Metal & Mining ────────────────────────────────────────────────────────
  TATASTEEL: "METAL", HINDALCO: "METAL", JSWSTEEL: "METAL", SAIL: "METAL",
  VEDL: "METAL", NATIONALUM: "METAL", NMDC: "METAL", COALINDIA: "METAL",
  MOIL: "METAL", APLAPOLLO: "METAL", RATNAMANI: "METAL", WELCORP: "METAL",
  GRAPHITE: "METAL", GPIL: "METAL", JINDALSAW: "METAL", JSWINFRA: "METAL",
  HINDCOPPER: "METAL", NIFTYMET: "METAL",

  // ── Real Estate ───────────────────────────────────────────────────────────
  DLF: "REALTY", GODREJPROP: "REALTY", PRESTIGE: "REALTY", OBEROIRLTY: "REALTY",
  PHOENIXLTD: "REALTY", BRIGADE: "REALTY", SOBHA: "REALTY", MAHINDRA: "REALTY",
  ANANTRAJ: "REALTY", MACROTECH: "REALTY", LODHA: "REALTY", SUNTECK: "REALTY",
  KOLTEPATIL: "REALTY", ARVIND: "REALTY",

  // ── Infrastructure & Capital Goods ────────────────────────────────────────
  LT: "INFRA", ABB: "INFRA", SIEMENS: "INFRA", BEL: "INFRA", HAL: "INFRA",
  BHEL: "INFRA", CUMMINSIND: "INFRA", THERMAX: "INFRA", POLYCAB: "INFRA",
  HAVELLS: "INFRA", AIAENG: "INFRA", KEC: "INFRA", KALPATPOWR: "INFRA",
  GRINFRA: "INFRA", GPPL: "INFRA", BHARATFORG: "INFRA", TITAGARH: "INFRA",
  RVNL: "INFRA", IRCON: "INFRA", RAILTEL: "INFRA", NCC: "INFRA",
  PNCINFRA: "INFRA", HG: "INFRA",

  // ── Telecom ───────────────────────────────────────────────────────────────
  BHARTIARTL: "TELECOM", IDEA: "TELECOM", INDUSTOWER: "TELECOM", TATACOMM: "TELECOM",
  HFCL: "TELECOM", STLTECH: "TELECOM",

  // ── Healthcare (non-pharma) ───────────────────────────────────────────────
  APOLLOHOSP: "HEALTHCARE", FORTIS: "HEALTHCARE", MAXHEALTH: "HEALTHCARE",
  NARAYANHRU: "HEALTHCARE", ASTER: "HEALTHCARE", NH: "HEALTHCARE",
  KIMS: "HEALTHCARE", MEDANTA: "HEALTHCARE", METROPOLIS: "HEALTHCARE",
  THYROCARE: "HEALTHCARE", LALPATHLAB: "HEALTHCARE",

  // ── Specialty Chemicals ───────────────────────────────────────────────────
  PIDILITIND: "CHEMICALS", AARTIIND: "CHEMICALS", VINATIORGA: "CHEMICALS",
  GALAXYSURF: "CHEMICALS", SRF: "CHEMICALS", DEEPAKNITR: "CHEMICALS",
  BALAMINES: "CHEMICALS", TATACHEM: "CHEMICALS", PCBL: "CHEMICALS",
  IOLCP: "CHEMICALS", CLEAN: "CHEMICALS", NAVINFLUOR: "CHEMICALS",
  FLUOROCHEM: "CHEMICALS", ALKYLAMINE: "CHEMICALS", FINEORG: "CHEMICALS",

  // ── PSU / Power / Defence ─────────────────────────────────────────────────
  NTPC: "PSU", POWERGRID: "PSU", RECLTD: "PSU", PFC: "PSU",
  IREDA: "PSU", IRFC: "PSU", HUDCO: "PSU", SJVN: "PSU",
  NHPC: "PSU", CONCOR: "PSU",
};

export function getSector(symbol: string): Sector {
  return SECTOR_MAP[symbol] ?? "OTHERS";
}

// Display labels for sector codes
export const SECTOR_LABELS: Record<Sector, string> = {
  BANK:       "Banking",
  NBFC:       "NBFC",
  IT:         "IT",
  PHARMA:     "Pharma",
  AUTO:       "Auto",
  FMCG:       "FMCG",
  ENERGY:     "Energy",
  METAL:      "Metal",
  REALTY:     "Realty",
  INFRA:      "Infra",
  TELECOM:    "Telecom",
  HEALTHCARE: "Healthcare",
  CHEMICALS:  "Chemicals",
  PSU:        "PSU",
  OTHERS:     "Others",
};
