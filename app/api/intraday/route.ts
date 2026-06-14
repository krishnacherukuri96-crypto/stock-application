import { NextResponse } from "next/server";

// ─── Stock universe (~249 NSE stocks) ────────────────────────────────────────
const STOCK_UNIVERSE: Array<{ symbol: string; name: string; sector: string }> = [
  // IT (20)
  { symbol: "INFY.NS",        name: "Infosys",           sector: "IT" },
  { symbol: "TCS.NS",         name: "TCS",               sector: "IT" },
  { symbol: "HCLTECH.NS",     name: "HCL Tech",          sector: "IT" },
  { symbol: "WIPRO.NS",       name: "Wipro",             sector: "IT" },
  { symbol: "TECHM.NS",       name: "Tech Mahindra",     sector: "IT" },
  { symbol: "LTIM.NS",        name: "LTI Mindtree",      sector: "IT" },
  { symbol: "MPHASIS.NS",     name: "Mphasis",           sector: "IT" },
  { symbol: "PERSISTENT.NS",  name: "Persistent Sys",    sector: "IT" },
  { symbol: "COFORGE.NS",     name: "Coforge",           sector: "IT" },
  { symbol: "KPIT.NS",        name: "KPIT Tech",         sector: "IT" },
  { symbol: "OFSS.NS",        name: "Oracle FS",         sector: "IT" },
  { symbol: "TATAELXSI.NS",   name: "Tata Elxsi",        sector: "IT" },
  { symbol: "NAUKRI.NS",      name: "Info Edge",         sector: "IT" },
  { symbol: "TANLA.NS",       name: "Tanla Platforms",   sector: "IT" },
  { symbol: "MASTEK.NS",      name: "Mastek",            sector: "IT" },
  { symbol: "CYIENT.NS",      name: "Cyient",            sector: "IT" },
  { symbol: "ZENSARTECH.NS",  name: "Zensar Tech",       sector: "IT" },
  { symbol: "INTELLECT.NS",   name: "Intellect Design",  sector: "IT" },
  { symbol: "BIRLASOFT.NS",   name: "Birlasoft",         sector: "IT" },
  { symbol: "NEWGEN.NS",      name: "Newgen Software",   sector: "IT" },

  // Banking (19)
  { symbol: "HDFCBANK.NS",    name: "HDFC Bank",         sector: "Banking" },
  { symbol: "ICICIBANK.NS",   name: "ICICI Bank",        sector: "Banking" },
  { symbol: "KOTAKBANK.NS",   name: "Kotak Bank",        sector: "Banking" },
  { symbol: "AXISBANK.NS",    name: "Axis Bank",         sector: "Banking" },
  { symbol: "SBIN.NS",        name: "State Bank",        sector: "Banking" },
  { symbol: "BANDHANBNK.NS",  name: "Bandhan Bank",      sector: "Banking" },
  { symbol: "FEDERALBNK.NS",  name: "Federal Bank",      sector: "Banking" },
  { symbol: "IDFCFIRSTB.NS",  name: "IDFC First Bank",   sector: "Banking" },
  { symbol: "INDUSINDBK.NS",  name: "IndusInd Bank",     sector: "Banking" },
  { symbol: "PNB.NS",         name: "Punjab National",   sector: "Banking" },
  { symbol: "BANKBARODA.NS",  name: "Bank of Baroda",    sector: "Banking" },
  { symbol: "CANBK.NS",       name: "Canara Bank",       sector: "Banking" },
  { symbol: "UNIONBANK.NS",   name: "Union Bank",        sector: "Banking" },
  { symbol: "RBLBANK.NS",     name: "RBL Bank",          sector: "Banking" },
  { symbol: "YESBANK.NS",     name: "Yes Bank",          sector: "Banking" },
  { symbol: "AUBANK.NS",      name: "AU Small Finance",  sector: "Banking" },
  { symbol: "DCBBANK.NS",     name: "DCB Bank",          sector: "Banking" },
  { symbol: "KARURVYSYA.NS",  name: "Karur Vysya",       sector: "Banking" },
  { symbol: "CSBBANK.NS",     name: "CSB Bank",          sector: "Banking" },

  // Pharma (16)
  { symbol: "SUNPHARMA.NS",   name: "Sun Pharma",        sector: "Pharma" },
  { symbol: "DRREDDY.NS",     name: "Dr Reddy's",        sector: "Pharma" },
  { symbol: "CIPLA.NS",       name: "Cipla",             sector: "Pharma" },
  { symbol: "DIVISLAB.NS",    name: "Divi's Labs",       sector: "Pharma" },
  { symbol: "AUROPHARMA.NS",  name: "Aurobindo Pharma",  sector: "Pharma" },
  { symbol: "ALKEM.NS",       name: "Alkem Labs",        sector: "Pharma" },
  { symbol: "TORNTPHARM.NS",  name: "Torrent Pharma",    sector: "Pharma" },
  { symbol: "BIOCON.NS",      name: "Biocon",            sector: "Pharma" },
  { symbol: "GLENMARK.NS",    name: "Glenmark Pharma",   sector: "Pharma" },
  { symbol: "LUPIN.NS",       name: "Lupin",             sector: "Pharma" },
  { symbol: "ABBOTINDIA.NS",  name: "Abbott India",      sector: "Pharma" },
  { symbol: "PFIZER.NS",      name: "Pfizer India",      sector: "Pharma" },
  { symbol: "NATCOPHARM.NS",  name: "Natco Pharma",      sector: "Pharma" },
  { symbol: "GRANULES.NS",    name: "Granules India",    sector: "Pharma" },
  { symbol: "LAURUSLABS.NS",  name: "Laurus Labs",       sector: "Pharma" },
  { symbol: "JUBLPHARMA.NS",  name: "Jubilant Pharmova", sector: "Pharma" },

  // Auto (15)
  { symbol: "TATAMOTORS.NS",  name: "Tata Motors",       sector: "Auto" },
  { symbol: "MARUTI.NS",      name: "Maruti",            sector: "Auto" },
  { symbol: "M&M.NS",         name: "M&M",               sector: "Auto" },
  { symbol: "BAJAJ-AUTO.NS",  name: "Bajaj Auto",        sector: "Auto" },
  { symbol: "EICHERMOT.NS",   name: "Eicher Motors",     sector: "Auto" },
  { symbol: "HEROMOTOCO.NS",  name: "Hero MotoCorp",     sector: "Auto" },
  { symbol: "TVSMOTORS.NS",   name: "TVS Motor",         sector: "Auto" },
  { symbol: "ASHOKLEY.NS",    name: "Ashok Leyland",     sector: "Auto" },
  { symbol: "ESCORTS.NS",     name: "Escorts Kubota",    sector: "Auto" },
  { symbol: "BOSCH.NS",       name: "Bosch",             sector: "Auto" },
  { symbol: "MOTHERSON.NS",   name: "Samvardhana M",     sector: "Auto" },
  { symbol: "BALKRISIND.NS",  name: "Balkrishna Ind",    sector: "Auto" },
  { symbol: "APOLLOTYRE.NS",  name: "Apollo Tyres",      sector: "Auto" },
  { symbol: "MRF.NS",         name: "MRF",               sector: "Auto" },
  { symbol: "CEATLTD.NS",     name: "CEAT",              sector: "Auto" },

  // FMCG (14)
  { symbol: "HINDUNILVR.NS",  name: "HUL",               sector: "FMCG" },
  { symbol: "ITC.NS",         name: "ITC",               sector: "FMCG" },
  { symbol: "NESTLEIND.NS",   name: "Nestle",            sector: "FMCG" },
  { symbol: "BRITANNIA.NS",   name: "Britannia",         sector: "FMCG" },
  { symbol: "DABUR.NS",       name: "Dabur",             sector: "FMCG" },
  { symbol: "MARICO.NS",      name: "Marico",            sector: "FMCG" },
  { symbol: "COLPAL.NS",      name: "Colgate-Palmolive", sector: "FMCG" },
  { symbol: "EMAMILTD.NS",    name: "Emami",             sector: "FMCG" },
  { symbol: "GODREJCP.NS",    name: "Godrej Consumer",   sector: "FMCG" },
  { symbol: "TATACONSUM.NS",  name: "Tata Consumer",     sector: "FMCG" },
  { symbol: "UBL.NS",         name: "United Breweries",  sector: "FMCG" },
  { symbol: "VBL.NS",         name: "Varun Beverages",   sector: "FMCG" },
  { symbol: "RADICO.NS",      name: "Radico Khaitan",    sector: "FMCG" },
  { symbol: "JYOTHYLAB.NS",   name: "Jyothy Labs",       sector: "FMCG" },

  // Energy (15)
  { symbol: "RELIANCE.NS",    name: "Reliance",          sector: "Energy" },
  { symbol: "ONGC.NS",        name: "ONGC",              sector: "Energy" },
  { symbol: "BPCL.NS",        name: "BPCL",              sector: "Energy" },
  { symbol: "IOC.NS",         name: "Indian Oil",        sector: "Energy" },
  { symbol: "ADANIGREEN.NS",  name: "Adani Green",       sector: "Energy" },
  { symbol: "TORNTPOWER.NS",  name: "Torrent Power",     sector: "Energy" },
  { symbol: "TATAPOWER.NS",   name: "Tata Power",        sector: "Energy" },
  { symbol: "CESC.NS",        name: "CESC",              sector: "Energy" },
  { symbol: "GAIL.NS",        name: "GAIL",              sector: "Energy" },
  { symbol: "PETRONET.NS",    name: "Petronet LNG",      sector: "Energy" },
  { symbol: "MGL.NS",         name: "Mahanagar Gas",     sector: "Energy" },
  { symbol: "IGL.NS",         name: "Indraprastha Gas",  sector: "Energy" },
  { symbol: "GSPL.NS",        name: "Gujarat State Petro", sector: "Energy" },
  { symbol: "ADANIPOWER.NS",  name: "Adani Power",       sector: "Energy" },
  { symbol: "SUZLON.NS",      name: "Suzlon Energy",     sector: "Energy" },

  // Metal (14)
  { symbol: "TATASTEEL.NS",   name: "Tata Steel",        sector: "Metal" },
  { symbol: "JSWSTEEL.NS",    name: "JSW Steel",         sector: "Metal" },
  { symbol: "HINDALCO.NS",    name: "Hindalco",          sector: "Metal" },
  { symbol: "COALINDIA.NS",   name: "Coal India",        sector: "Metal" },
  { symbol: "NMDC.NS",        name: "NMDC",              sector: "Metal" },
  { symbol: "VEDL.NS",        name: "Vedanta",           sector: "Metal" },
  { symbol: "SAIL.NS",        name: "SAIL",              sector: "Metal" },
  { symbol: "MOIL.NS",        name: "MOIL",              sector: "Metal" },
  { symbol: "NATIONALUM.NS",  name: "NALCO",             sector: "Metal" },
  { symbol: "APLAPOLLO.NS",   name: "APL Apollo Tubes",  sector: "Metal" },
  { symbol: "HINDCOPPER.NS",  name: "Hindustan Copper",  sector: "Metal" },
  { symbol: "RATNAMANI.NS",   name: "Ratnamani Metals",  sector: "Metal" },
  { symbol: "WELCORP.NS",     name: "Welspun Corp",      sector: "Metal" },
  { symbol: "JSPL.NS",        name: "Jindal Steel",      sector: "Metal" },

  // Infra / Cement (15)
  { symbol: "LT.NS",          name: "L&T",               sector: "Infra" },
  { symbol: "ULTRACEMCO.NS",  name: "UltraTech Cement",  sector: "Infra" },
  { symbol: "NTPC.NS",        name: "NTPC",              sector: "Infra" },
  { symbol: "POWERGRID.NS",   name: "Power Grid",        sector: "Infra" },
  { symbol: "ADANIPORTS.NS",  name: "Adani Ports",       sector: "Infra" },
  { symbol: "AMBUJACEM.NS",   name: "Ambuja Cements",    sector: "Infra" },
  { symbol: "ACC.NS",         name: "ACC",               sector: "Infra" },
  { symbol: "SHREECEM.NS",    name: "Shree Cement",      sector: "Infra" },
  { symbol: "RAMCOCEM.NS",    name: "Ramco Cements",     sector: "Infra" },
  { symbol: "JKCEMENT.NS",    name: "JK Cement",         sector: "Infra" },
  { symbol: "DALMIA.NS",      name: "Dalmia Bharat",     sector: "Infra" },
  { symbol: "GRASIM.NS",      name: "Grasim",            sector: "Infra" },
  { symbol: "SIEMENS.NS",     name: "Siemens",           sector: "Infra" },
  { symbol: "ABB.NS",         name: "ABB India",         sector: "Infra" },
  { symbol: "HAVELLS.NS",     name: "Havells",           sector: "Infra" },

  // Finance / NBFC (19)
  { symbol: "BAJFINANCE.NS",  name: "Bajaj Finance",     sector: "Finance" },
  { symbol: "BAJAJFINSV.NS",  name: "Bajaj Finserv",     sector: "Finance" },
  { symbol: "HDFCLIFE.NS",    name: "HDFC Life",         sector: "Finance" },
  { symbol: "SBILIFE.NS",     name: "SBI Life",          sector: "Finance" },
  { symbol: "ICICIGI.NS",     name: "ICICI Lombard",     sector: "Finance" },
  { symbol: "LICI.NS",        name: "LIC India",         sector: "Finance" },
  { symbol: "MUTHOOTFIN.NS",  name: "Muthoot Finance",   sector: "Finance" },
  { symbol: "CHOLAFIN.NS",    name: "Chola Finance",     sector: "Finance" },
  { symbol: "SHRIRAMFIN.NS",  name: "Shriram Finance",   sector: "Finance" },
  { symbol: "PNBHOUSING.NS",  name: "PNB Housing",       sector: "Finance" },
  { symbol: "LICHSGFIN.NS",   name: "LIC Housing Fin",   sector: "Finance" },
  { symbol: "CANFINHOME.NS",  name: "Can Fin Homes",     sector: "Finance" },
  { symbol: "MANAPPURAM.NS",  name: "Manappuram Fin",    sector: "Finance" },
  { symbol: "CDSL.NS",        name: "CDSL",              sector: "Finance" },
  { symbol: "BSE.NS",         name: "BSE",               sector: "Finance" },
  { symbol: "ANGELONE.NS",    name: "Angel One",         sector: "Finance" },
  { symbol: "IIFLWAM.NS",     name: "IIFL Wealth",       sector: "Finance" },
  { symbol: "MOTILALOFS.NS",  name: "Motilal Oswal FS",  sector: "Finance" },
  { symbol: "LTFH.NS",        name: "L&T Finance",       sector: "Finance" },

  // Consumer Durables (14)
  { symbol: "ASIANPAINT.NS",  name: "Asian Paints",      sector: "Consumer" },
  { symbol: "TITAN.NS",       name: "Titan",             sector: "Consumer" },
  { symbol: "CROMPTON.NS",    name: "Crompton Greaves",  sector: "Consumer" },
  { symbol: "VGUARD.NS",      name: "V-Guard",           sector: "Consumer" },
  { symbol: "VOLTAS.NS",      name: "Voltas",            sector: "Consumer" },
  { symbol: "BLUESTARCO.NS",  name: "Blue Star",         sector: "Consumer" },
  { symbol: "POLYCAB.NS",     name: "Polycab",           sector: "Consumer" },
  { symbol: "DIXON.NS",       name: "Dixon Tech",        sector: "Consumer" },
  { symbol: "AMBER.NS",       name: "Amber Enterprises", sector: "Consumer" },
  { symbol: "KAJARIACER.NS",  name: "Kajaria Ceramics",  sector: "Consumer" },
  { symbol: "BATAINDIA.NS",   name: "Bata India",        sector: "Consumer" },
  { symbol: "RELAXO.NS",      name: "Relaxo Footwear",   sector: "Consumer" },
  { symbol: "VMART.NS",       name: "V-Mart Retail",     sector: "Consumer" },
  { symbol: "SUPREMEIND.NS",  name: "Supreme Industries", sector: "Consumer" },

  // Chemicals (12)
  { symbol: "PIDILITIND.NS",  name: "Pidilite",          sector: "Chemicals" },
  { symbol: "SRF.NS",         name: "SRF",               sector: "Chemicals" },
  { symbol: "DEEPAKNI.NS",    name: "Deepak Nitrite",    sector: "Chemicals" },
  { symbol: "AARTIIND.NS",    name: "Aarti Industries",  sector: "Chemicals" },
  { symbol: "VINATIORGA.NS",  name: "Vinati Organics",   sector: "Chemicals" },
  { symbol: "NAVINFLUOR.NS",  name: "Navin Fluorine",    sector: "Chemicals" },
  { symbol: "ALKYLAMINE.NS",  name: "Alkyl Amines",      sector: "Chemicals" },
  { symbol: "BALAJIAM.NS",    name: "Balaji Amines",     sector: "Chemicals" },
  { symbol: "TATACHEM.NS",    name: "Tata Chemicals",    sector: "Chemicals" },
  { symbol: "NOCIL.NS",       name: "NOCIL",             sector: "Chemicals" },
  { symbol: "FINEORG.NS",     name: "Fine Organics",     sector: "Chemicals" },
  { symbol: "SUDARSCHEM.NS",  name: "Sudarshan Chem",    sector: "Chemicals" },

  // Telecom (5)
  { symbol: "BHARTIARTL.NS",  name: "Bharti Airtel",     sector: "Telecom" },
  { symbol: "IDEA.NS",        name: "Vodafone Idea",     sector: "Telecom" },
  { symbol: "INDUSTOWER.NS",  name: "Indus Towers",      sector: "Telecom" },
  { symbol: "TATACOMM.NS",    name: "Tata Comms",        sector: "Telecom" },
  { symbol: "STLTECH.NS",     name: "Sterlite Tech",     sector: "Telecom" },

  // Real Estate (7)
  { symbol: "DLF.NS",         name: "DLF",               sector: "RealEstate" },
  { symbol: "GODREJPROP.NS",  name: "Godrej Properties", sector: "RealEstate" },
  { symbol: "OBEROIRLTY.NS",  name: "Oberoi Realty",     sector: "RealEstate" },
  { symbol: "PRESTIGE.NS",    name: "Prestige Estates",  sector: "RealEstate" },
  { symbol: "PHOENIXLTD.NS",  name: "Phoenix Mills",     sector: "RealEstate" },
  { symbol: "MACROTECH.NS",   name: "Macrotech (Lodha)", sector: "RealEstate" },
  { symbol: "BRIGADE.NS",     name: "Brigade Enterprises", sector: "RealEstate" },

  // Healthcare (9)
  { symbol: "APOLLOHOSP.NS",  name: "Apollo Hospitals",  sector: "Healthcare" },
  { symbol: "MAXHEALTH.NS",   name: "Max Healthcare",    sector: "Healthcare" },
  { symbol: "FORTIS.NS",      name: "Fortis Healthcare", sector: "Healthcare" },
  { symbol: "METROPOLIS.NS",  name: "Metropolis",        sector: "Healthcare" },
  { symbol: "LALPATHLAB.NS",  name: "Dr Lal PathLabs",   sector: "Healthcare" },
  { symbol: "RAINBOW.NS",     name: "Rainbow Childrens", sector: "Healthcare" },
  { symbol: "KIMS.NS",        name: "KIMS Health",       sector: "Healthcare" },
  { symbol: "NH.NS",          name: "Narayana Hrudayalaya", sector: "Healthcare" },
  { symbol: "GLOBALHLTH.NS",  name: "Global Health",     sector: "Healthcare" },

  // Defence (6)
  { symbol: "HAL.NS",         name: "HAL",               sector: "Defence" },
  { symbol: "BEL.NS",         name: "Bharat Electronics", sector: "Defence" },
  { symbol: "BEML.NS",        name: "BEML",              sector: "Defence" },
  { symbol: "BDL.NS",         name: "Bharat Dynamics",   sector: "Defence" },
  { symbol: "GRSE.NS",        name: "Garden Reach Ship", sector: "Defence" },
  { symbol: "COCHINSHIP.NS",  name: "Cochin Shipyard",   sector: "Defence" },

  // Agrochem (7)
  { symbol: "UPL.NS",         name: "UPL",               sector: "Agrochem" },
  { symbol: "COROMANDEL.NS",  name: "Coromandel",        sector: "Agrochem" },
  { symbol: "PIIND.NS",       name: "PI Industries",     sector: "Agrochem" },
  { symbol: "BAYER.NS",       name: "Bayer CropScience", sector: "Agrochem" },
  { symbol: "RALLIS.NS",      name: "Rallis India",      sector: "Agrochem" },
  { symbol: "CHAMBAL.NS",     name: "Chambal Fertilisers", sector: "Agrochem" },
  { symbol: "GODREJAGRO.NS",  name: "Godrej Agrovet",    sector: "Agrochem" },

  // Railways (6)
  { symbol: "IRCTC.NS",       name: "IRCTC",             sector: "Railways" },
  { symbol: "CONCOR.NS",      name: "Container Corp",    sector: "Railways" },
  { symbol: "RVNL.NS",        name: "Rail Vikas Nigam",  sector: "Railways" },
  { symbol: "IRCON.NS",       name: "IRCON",             sector: "Railways" },
  { symbol: "IRFC.NS",        name: "IRFC",              sector: "Railways" },
  { symbol: "TITAGARH.NS",    name: "Titagarh Wagons",   sector: "Railways" },

  // Aviation (3)
  { symbol: "INDIGO.NS",      name: "IndiGo",            sector: "Aviation" },
  { symbol: "SPICEJET.NS",    name: "SpiceJet",          sector: "Aviation" },
  { symbol: "BLUEDART.NS",    name: "Blue Dart",         sector: "Aviation" },

  // Capital Goods (11)
  { symbol: "THERMAX.NS",     name: "Thermax",           sector: "CapGoods" },
  { symbol: "CUMMINSIND.NS",  name: "Cummins India",     sector: "CapGoods" },
  { symbol: "KEC.NS",         name: "KEC International", sector: "CapGoods" },
  { symbol: "BHEL.NS",        name: "BHEL",              sector: "CapGoods" },
  { symbol: "KPIL.NS",        name: "Kalpataru Projects", sector: "CapGoods" },
  { symbol: "NCC.NS",         name: "NCC",               sector: "CapGoods" },
  { symbol: "NBCC.NS",        name: "NBCC",              sector: "CapGoods" },
  { symbol: "PNCINFRA.NS",    name: "PNC Infratech",     sector: "CapGoods" },
  { symbol: "KAYNES.NS",      name: "Kaynes Technology", sector: "CapGoods" },
  { symbol: "INOXWIND.NS",    name: "Inox Wind",         sector: "CapGoods" },
  { symbol: "ELECON.NS",      name: "Elecon Engineering", sector: "CapGoods" },

  // Media (5)
  { symbol: "ZEEL.NS",        name: "Zee Entertainment", sector: "Media" },
  { symbol: "SUNNETWORK.NS",  name: "Sun TV Network",    sector: "Media" },
  { symbol: "PVRINOX.NS",     name: "PVR Inox",          sector: "Media" },
  { symbol: "NETWORK18.NS",   name: "Network 18",        sector: "Media" },
  { symbol: "HATHWAY.NS",     name: "Hathway Cable",     sector: "Media" },

  // Retail / QSR (9)
  { symbol: "DMART.NS",       name: "Avenue Supermarts", sector: "Retail" },
  { symbol: "JUBLFOOD.NS",    name: "Jubilant Foodworks", sector: "Retail" },
  { symbol: "WESTLIFE.NS",    name: "Westlife Foodworld", sector: "Retail" },
  { symbol: "DEVYANI.NS",     name: "Devyani Intl",      sector: "Retail" },
  { symbol: "SAPPHIRE.NS",    name: "Sapphire Foods",    sector: "Retail" },
  { symbol: "CAMPUS.NS",      name: "Campus Activewear", sector: "Retail" },
  { symbol: "ABFRL.NS",       name: "Aditya Birla Fashion", sector: "Retail" },
  { symbol: "SHOPERSTOP.NS",  name: "Shoppers Stop",     sector: "Retail" },
  { symbol: "TRENT.NS",       name: "Trent (Westside)",  sector: "Retail" },

  // Tech / New-age (8)
  { symbol: "ZOMATO.NS",      name: "Zomato",            sector: "Tech" },
  { symbol: "FSN.NS",         name: "Nykaa",             sector: "Tech" },
  { symbol: "PAYTM.NS",       name: "Paytm",             sector: "Tech" },
  { symbol: "POLICYBZR.NS",   name: "PB Fintech",        sector: "Tech" },
  { symbol: "MAPMYINDIA.NS",  name: "MapmyIndia",        sector: "Tech" },
  { symbol: "INDIAMART.NS",   name: "IndiaMart",         sector: "Tech" },
  { symbol: "JUSTDIAL.NS",    name: "Just Dial",         sector: "Tech" },
  { symbol: "CARTRADE.NS",    name: "CarTrade Tech",     sector: "Tech" },
];

const SECTOR_INDICES: Record<string, string> = {
  IT:          "^CNXIT",
  Banking:     "^NSEBANK",
  Pharma:      "^CNXPHARMA",
  Auto:        "^CNXAUTO",
  FMCG:        "^CNXFMCG",
  Energy:      "^CNXENERGY",
  Metal:       "^CNXMETAL",
  Infra:       "^CNXINFRA",
  Finance:     "^CNXFINANCE",
  Consumer:    "^CNXCONSUMR",
  RealEstate:  "^CNXREALTY",
  Media:       "^CNXMEDIA",
};

const MAIN_INDICES = ["^NSEI", "^NSEBANK", "^INDIAVIX"];

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Core quote fetch ─────────────────────────────────────────────────────────
interface QuoteData {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  prevClose: number;
}

async function fetchChartQuote(symbol: string): Promise<QuoteData | null> {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, { headers: YF_HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const q    = result.indicators?.quote?.[0] ?? {};

    const price     = meta.regularMarketPrice as number;
    const prevClose = (meta.chartPreviousClose ?? meta.previousClose ?? price) as number;
    const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

    const opens:   number[] = (q.open   ?? []).filter((v: number | null) => v != null);
    const volumes: number[] = (q.volume ?? []).filter((v: number | null) => v != null && v > 0);

    const prevVolumes = volumes.slice(0, -1);
    const avgVolume = prevVolumes.length > 0
      ? prevVolumes.reduce((a, b) => a + b, 0) / prevVolumes.length
      : volumes[0] ?? 0;

    return {
      symbol,
      price,
      changePercent,
      volume:   (meta.regularMarketVolume ?? volumes[volumes.length - 1] ?? 0) as number,
      avgVolume,
      dayHigh:  (meta.regularMarketDayHigh ?? 0) as number,
      dayLow:   (meta.regularMarketDayLow  ?? 0) as number,
      open:     (opens.length > 0 ? opens[opens.length - 1] : price),
      prevClose,
    };
  } catch {
    return null;
  }
}

// Batch in groups of 60 to avoid rate-limiting with the larger universe
async function fetchAllQuotes(symbols: string[]): Promise<Map<string, QuoteData>> {
  const map = new Map<string, QuoteData>();
  const BATCH = 60;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH);
    const results = await Promise.allSettled(chunk.map(fetchChartQuote));
    results.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value) map.set(chunk[j], r.value);
    });
  }
  return map;
}

// ─── NSE market hours (IST UTC+5:30) ─────────────────────────────────────────
function isNSEOpen(): boolean {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 9 * 60 + 15 && mins < 15 * 60 + 30;
}

function getSessionProgress(): number {
  if (!isNSEOpen()) return 1;
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const elapsed = ist.getUTCHours() * 60 + ist.getUTCMinutes() - (9 * 60 + 15);
  return Math.max(0.05, Math.min(1, elapsed / 375));
}

// ─── ET Markets news ──────────────────────────────────────────────────────────
async function fetchNews() {
  try {
    const res = await fetch(
      "https://economictimes.indiatimes.com/markets/stocks/rss.cms",
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; research-dashboard/1.0)" }, cache: "no-store" }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const items: Array<{ title: string; link: string; pubDate: string }> = [];
    for (const raw of (xml.match(/<item>[\s\S]*?<\/item>/g) ?? []).slice(0, 12)) {
      const t = raw.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const l = raw.match(/<link>([^<]+)<\/link>/);
      const d = raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      if (t?.[1] && l?.[1]) {
        items.push({ title: t[1].trim(), link: l[1].trim(), pubDate: d?.[1]?.trim() ?? "" });
      }
    }
    return items;
  } catch { return []; }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
function mktScore(niftyChg: number, bankNiftyChg: number, vix: number): number {
  let s = niftyChg >= 1 ? 10 : niftyChg >= 0.5 ? 8 : niftyChg >= 0 ? 6 : niftyChg >= -0.5 ? 4 : 2;
  s += bankNiftyChg >= niftyChg - 0.5 ? 5 : 2;
  s += vix < 13 ? 5 : vix < 16 ? 4 : vix < 20 ? 3 : 1;
  return Math.min(20, s);
}

// Forward-looking RS: sweet spot is 0.5–2.5% outperformance (fresh leadership, room to run).
// Penalise stocks that already ran hard (>3.5% above Nifty) — chasing them is high-reversal-risk.
function rsScore(stockChg: number, niftyChg: number): number {
  const outperf = stockChg - niftyChg;
  if (outperf >= 3.5) return 7;   // Extended — don't chase; reversal risk is high
  if (outperf >= 2.5) return 14;  // Strong but getting stretched
  if (outperf >= 1.0) return 20;  // Sweet spot: fresh leadership, meaningful room left
  if (outperf >= 0.5) return 17;  // Early emerging leadership
  if (outperf >= 0.0) return 11;  // Neutral
  if (outperf >= -1)  return 6;
  if (outperf >= -2)  return 3;
  return 1;
}

function volScore(vol: number, avgVol: number, outperf: number): number {
  if (!avgVol) return 7;
  const expected = avgVol * getSessionProgress();
  const r = vol / expected;
  if (outperf < -2 && r >= 1.5) return r >= 3 ? 4 : 3;
  if (r >= 4)   return 15;
  if (r >= 3)   return 13;
  if (r >= 2)   return 11;
  if (r >= 1.5) return 9;
  if (r >= 1)   return 7;
  return 4;
}

// Replaces vwapScore + priceActionScore with a forward-looking position quality check.
// A stock *just above* VWAP with mid-range price position is a fresh setup with room to run.
// A stock glued to day high way above VWAP has already moved — less predictive upside.
function positionScore(price: number, open: number, high: number, low: number): number {
  if (high === low) return 10;
  const approxVWAP = (high + low) / 2;
  const vwapPct    = price / approxVWAP;       // 1.0 = at VWAP; >1 = above
  const rangePos   = (price - low) / (high - low); // 0 = day low, 1 = day high

  let s = 0;

  // VWAP freshness: just crossed VWAP upward = strongest signal (setup just happening now)
  if      (vwapPct >= 1.0  && vwapPct < 1.015) s += 10; // Fresh above VWAP — prime setup
  else if (vwapPct >= 1.015 && vwapPct < 1.04) s += 7;  // Moderately above — still good
  else if (vwapPct >= 1.04)                    s += 3;  // Extended above VWAP — less room
  else if (vwapPct >= 0.98)                    s += 4;  // Just below VWAP
  else                                         s += 1;  // Well below VWAP — bearish

  // Day range position: mid-to-upper range with room to run scores best
  // Being *at* day high means already extended; mid-range = still has room
  if      (rangePos >= 0.55 && rangePos <= 0.80) s += 8; // Mid-upper: trending, room to run
  else if (rangePos > 0.80 && rangePos <= 0.92)  s += 6; // Upper: near HOD, possible breakout
  else if (rangePos > 0.92)                      s += 3; // Glued to HOD — likely extended
  else if (rangePos >= 0.35)                     s += 5; // Mid range — neutral
  else                                           s += 2; // Near LOD — bearish bias

  // Bullish close vs open
  if (price > open) s += 2;

  return Math.min(20, s);
}

// Session timing: earlier in the day = more time for the setup to play out = higher score.
function sessionTimingScore(): number {
  if (!isNSEOpen()) return 5; // Outside market hours: treat as early session for screening
  const prog = getSessionProgress(); // 0 = 9:15 AM, 1 = 3:30 PM
  if (prog < 0.20) return 5; // 9:15–10:30 AM: prime time, full score
  if (prog < 0.40) return 4; // 10:30–11:45 AM
  if (prog < 0.60) return 3; // 11:45–1:00 PM
  if (prog < 0.80) return 2; // 1:00–2:15 PM
  return 1;                  // 2:15–3:30 PM: late day, minimal time to play
}

function sectorRankScore(sectorChg: number, allChanges: number[]): number {
  const sorted = [...allChanges].sort((a, b) => b - a);
  const rank = sorted.findIndex((v) => v <= sectorChg);
  return Math.round(15 * (1 - (rank < 0 ? 0 : rank) / Math.max(1, sorted.length - 1)));
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const allSymbols = [
      ...MAIN_INDICES,
      ...Object.values(SECTOR_INDICES),
      ...STOCK_UNIVERSE.map((s) => s.symbol),
    ];

    const [quoteMap, news] = await Promise.all([
      fetchAllQuotes(allSymbols),
      fetchNews(),
    ]);

    const niftyQ     = quoteMap.get("^NSEI");
    const bankNiftyQ = quoteMap.get("^NSEBANK");
    const vixQ       = quoteMap.get("^INDIAVIX");

    const niftyChg     = niftyQ?.changePercent     ?? 0;
    const bankNiftyChg = bankNiftyQ?.changePercent  ?? 0;
    const vixLevel     = vixQ?.price               ?? 15;

    const marketScoreVal = mktScore(niftyChg, bankNiftyChg, vixLevel);

    const sectorChanges: Record<string, number> = {};
    const sectorHasData: Record<string, boolean> = {};
    for (const [sector, idx] of Object.entries(SECTOR_INDICES)) {
      const q = quoteMap.get(idx);
      sectorHasData[sector] = !!q;
      sectorChanges[sector] = q?.changePercent ?? 0;
    }

    const realSectorVals = Object.entries(sectorChanges)
      .filter(([s]) => sectorHasData[s])
      .map(([, v]) => v);
    const allSectorVals = realSectorVals.length > 0 ? realSectorVals : Object.values(sectorChanges);

    const sectors = Object.entries(sectorChanges)
      .map(([name, change]) => {
        const q = quoteMap.get(SECTOR_INDICES[name]);
        return {
          name,
          change,
          price: q?.price ?? null,
          score: sectorHasData[name] ? sectorRankScore(change, allSectorVals) : 0,
          hasData: sectorHasData[name],
        };
      })
      .sort((a, b) => b.score - a.score);

    const stocks = STOCK_UNIVERSE.map((stock) => {
      const q = quoteMap.get(stock.symbol);
      if (!q) return null;

      const sectorChg   = sectorChanges[stock.sector] ?? 0;
      const sectorScore = sectorHasData[stock.sector]
        ? sectorRankScore(sectorChg, allSectorVals)
        : 7;
      const outperf     = parseFloat((q.changePercent - niftyChg).toFixed(2));
      const sessionProg = getSessionProgress();
      const volRatio    = q.avgVolume > 0
        ? parseFloat((q.volume / (q.avgVolume * sessionProg)).toFixed(2))
        : 1;
      const approxVWAP  = parseFloat(((q.dayHigh + q.dayLow) / 2).toFixed(2));
      const aboveVWAP   = q.price >= approxVWAP;

      const rawScore =
        marketScoreVal +
        sectorScore +
        rsScore(q.changePercent, niftyChg) +
        volScore(q.volume, q.avgVolume, outperf) +
        positionScore(q.price, q.open, q.dayHigh, q.dayLow) +
        sessionTimingScore();

      const score = Math.min(100, Math.round((rawScore / 95) * 100));
      const setup =
        score >= 85 ? "A+ Long" :
        score >= 75 ? "Long" :
        score >= 60 ? "Watch" : "Avoid";

      return {
        symbol:      stock.symbol.replace(".NS", ""),
        name:        stock.name,
        sector:      stock.sector,
        price:       q.price,
        change:      parseFloat(q.changePercent.toFixed(2)),
        rs: outperf,
        volumeRatio: volRatio,
        aboveVWAP,
        approxVWAP,
        high:  q.dayHigh,
        low:   q.dayLow,
        open:  q.open,
        score,
        setup,
      };
    })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score) as ScoredStock[];

    const advancing   = stocks.filter((s) => s.change > 0.1).length;
    const declining   = stocks.filter((s) => s.change < -0.1).length;
    const unchanged   = stocks.length - advancing - declining;
    const aboveAvgVol = stocks.filter((s) => s.volumeRatio >= 1.5).length;
    const adRatio     = declining > 0 ? parseFloat((advancing / declining).toFixed(2)) : advancing > 0 ? 10 : 1;
    const breadthSignal =
      adRatio >= 2   ? "Strong"    :
      adRatio >= 1   ? "Mixed"     :
      adRatio >= 0.5 ? "Weak"      : "Very Weak";

    return NextResponse.json({
      market: {
        nifty:     { price: niftyQ?.price, change: niftyChg, high: niftyQ?.dayHigh, low: niftyQ?.dayLow },
        bankNifty: { price: bankNiftyQ?.price, change: bankNiftyChg },
        vix:       { level: vixLevel, status: vixLevel < 13 ? "Low" : vixLevel < 18 ? "Moderate" : "High" },
        score:     marketScoreVal,
        trend:     niftyChg >= 0.5 ? "Bullish" : niftyChg <= -0.5 ? "Bearish" : "Neutral",
        isOpen:    isNSEOpen(),
        dataPoints: quoteMap.size,
      },
      breadth: { advancing, declining, unchanged, aboveAvgVol, total: stocks.length, adRatio, signal: breadthSignal },
      sectors,
      stocks,
      news,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export interface ScoredStock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  rs: number;
  volumeRatio: number;
  aboveVWAP: boolean;
  approxVWAP: number;
  high: number;
  low: number;
  open: number;
  score: number;
  setup: string;
}
